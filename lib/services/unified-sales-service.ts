import { prisma } from '@/lib/prisma'
import { salesRepository } from '@/lib/repositories/sales-repository'
import { getStripe, stripeBreaker } from '@/lib/stripe'
import { eventBus } from '@/lib/events/bus'
import { nextDocNumber } from '@/lib/services/numbering'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// ── POS Sale ────────────────────────────────────────────────────────────

export interface PosLineInput {
  itemId: string
  quantity: number
  lineDiscountGbp?: number
}

export interface PosSaleInput {
  customerId?: string | null
  paymentMethod: string
  stripePaymentIntentId?: string
  lineItems: PosLineInput[]
  userId?: string
}

export async function processPosSale(
  input: PosSaleInput,
): Promise<{ order: { id: string; grandTotalGbp: number; vatAmountGbp: number } }> {
  const itemIds = Array.from(new Set(input.lineItems.map((li) => li.itemId)))
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds }, deletedAt: null },
  })
  const itemById = new Map(items.map((i) => [i.id, i]))
  const settings = await prisma.storeSettings.findUnique({ where: { id: 'store' } })

  const computedLines = input.lineItems.map((li) => {
    const item = itemById.get(li.itemId)
    if (!item) throw new Error(`Item ${li.itemId} not found`)
    if (!item.isActive || !item.isSellable) throw new Error(`${item.name} is not available for sale`)
    const unitPrice = Number(item.sellingPrice)
    const vatRate = Number(item.vatRate)
    const gross = round2(unitPrice * li.quantity)
    const discount = Math.min(round2(li.lineDiscountGbp ?? 0), gross)
    const net = round2(gross - discount)
    const vat = round2(net * vatRate)
    return {
      itemId: li.itemId,
      quantity: li.quantity,
      unitPriceGbp: unitPrice,
      lineDiscountGbp: discount,
      vatRateApplied: vatRate,
      _net: net,
      _vat: vat,
    }
  })

  const totalDiscountGbp = round2(computedLines.reduce((s, l) => s + l.lineDiscountGbp, 0))
  const netTotalGbp = round2(computedLines.reduce((s, l) => s + l._net, 0))
  const vatAmountGbp = round2(computedLines.reduce((s, l) => s + l._vat, 0))
  const grandTotalGbp = round2(netTotalGbp + vatAmountGbp)

  let stripePaymentStatus: string | undefined
  if (input.paymentMethod === 'Card' && input.stripePaymentIntentId) {
    const pi = await stripeBreaker.call(() =>
      getStripe().paymentIntents.retrieve(input.stripePaymentIntentId!),
    )
    if (pi.status !== 'succeeded') {
      throw new Error(`Card payment not completed (status: ${pi.status})`)
    }
    const chargedAmount = (pi.amount_received ?? 0) / 100
    if (Math.abs(chargedAmount - grandTotalGbp) > 0.01) {
      throw new Error(`Payment amount mismatch: charged ${chargedAmount}, expected ${grandTotalGbp}`)
    }
    stripePaymentStatus = 'succeeded'
  }

  const stockMoves: { itemId: string; warehouseId: string; quantity: number; unitCost: number }[] = []

  const newOrder = await prisma.$transaction(async (tx) => {
    stockMoves.length = 0

    for (const l of computedLines) {
      const item = itemById.get(l.itemId)!
      let warehouseId = settings?.posWarehouseId ?? null
      let unitCost = Number(item.standardCost)
      if (warehouseId) {
        const at = await tx.warehouseStock.findUnique({
          where: { warehouseId_itemId: { warehouseId, itemId: l.itemId } },
        })
        if (!at) warehouseId = null
        else unitCost = Number(at.avgCost)
      }
      if (!warehouseId) {
        const top = await tx.warehouseStock.findFirst({
          where: { itemId: l.itemId },
          orderBy: { quantity: 'desc' },
        })
        warehouseId = top?.warehouseId ?? null
        if (top) unitCost = Number(top.avgCost)
      }
      if (!warehouseId) throw new Error(`No stock location for ${item.name}`)

      const dec = await tx.warehouseStock.updateMany({
        where: { warehouseId, itemId: l.itemId, quantity: { gte: l.quantity } },
        data: { quantity: { decrement: l.quantity } },
      })
      if (dec.count !== 1) throw new Error(`Insufficient stock for ${item.name}`)

      stockMoves.push({ itemId: l.itemId, warehouseId, quantity: l.quantity, unitCost })
    }

    const created = await salesRepository.createPosOrder(tx, {
      customerId: input.customerId ?? null,
      paymentMethod: input.paymentMethod,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      stripePaymentStatus: stripePaymentStatus ?? null,
      computedLines: computedLines.map((l) => ({
        itemId: l.itemId,
        description: itemById.get(l.itemId)?.name ?? `Item ${l.itemId}`,
        quantity: l.quantity,
        unitPriceGbp: l.unitPriceGbp,
        lineDiscountGbp: l.lineDiscountGbp,
        vatRateApplied: l.vatRateApplied,
        net: l._net,
        vat: l._vat,
      })),
      totals: { totalDiscountGbp, netTotalGbp, vatAmountGbp, grandTotalGbp },
    })

    const saleDate = new Date()
    await tx.stockLedger.createMany({
      data: stockMoves.map((m) => ({
        itemId: m.itemId,
        warehouseId: m.warehouseId,
        transactionType: 'OUT',
        quantity: -m.quantity,
        unitCost: m.unitCost,
        totalCost: round2(m.unitCost * m.quantity),
        referenceType: 'POS',
        referenceId: created.id,
        notes: `POS sale #${created.id}`,
        transactionDate: saleDate,
      })),
    })

    if (input.customerId) {
      const pointsEarned = Math.floor(grandTotalGbp)
      await tx.customer.update({
        where: { id: input.customerId },
        data: { loyaltyPointsBalance: { increment: pointsEarned } },
      })
    }

    return created
  }, { isolationLevel: 'Serializable' })

  const totalCost = round2(stockMoves.reduce((s, m) => s + m.unitCost * m.quantity, 0))
  eventBus.emit('pos.sale_completed', {
    orderId: newOrder.id,
    netTotal: netTotalGbp,
    vatAmount: vatAmountGbp,
    grandTotal: grandTotalGbp,
    totalCost,
    paymentMethod: input.paymentMethod,
    userId: input.userId ?? 'system',
  })

  if (input.stripePaymentIntentId) {
    stripeBreaker
      .call(() =>
        getStripe().paymentIntents.update(input.stripePaymentIntentId!, {
          metadata: { posOrderId: newOrder.id },
        }),
      )
      .catch(() => {})
  }

  return {
    order: {
      id: newOrder.id,
      grandTotalGbp: Number(newOrder.totalAmount),
      vatAmountGbp: Number(newOrder.taxAmount),
    },
  }
}

// ── POS Return ──────────────────────────────────────────────────────────

export interface PosReturnInput {
  originalOrderId: string
  originalLineId: string
  quantityReturned: number
  reason: string
  userId?: string
}

export async function processPosReturn(input: PosReturnInput) {
  const lineItem = await prisma.salesOrderItemV2.findUnique({
    where: { id: input.originalLineId },
  })
  if (!lineItem) throw new Error('Line item not found')
  if (lineItem.soId !== input.originalOrderId) {
    throw new Error('Line item does not belong to this order')
  }

  const totalQty = Number(lineItem.quantity)
  const paidPayments = await prisma.salesPayment.findMany({
    where: { soId: input.originalOrderId, amount: { gt: 0 } },
  })
  const previouslyRefunded = await prisma.salesPayment.findMany({
    where: { soId: input.originalOrderId, amount: { lt: 0 } },
  })
  const totalPaid = paidPayments.reduce((s, p) => s + Number(p.amount), 0)
  const totalRefunded = Math.abs(previouslyRefunded.reduce((s, p) => s + Number(p.amount), 0))

  const alreadyReturned = previouslyRefunded.length > 0 ? totalRefunded / (totalPaid / totalQty) : 0
  const alreadyReturnedQty = Math.round(alreadyReturned)
  const returnable = totalQty - alreadyReturnedQty
  if (input.quantityReturned > returnable) {
    throw new Error(`Only ${returnable} unit(s) remain returnable on this line`)
  }

  const unitPrice = Number(lineItem.unitPrice)
  const unitDiscount = totalQty > 0 ? Number(lineItem.discount) / totalQty : 0
  const unitNet = unitPrice - unitDiscount
  const unitGross = unitNet * (1 + Number(lineItem.taxRate))
  const refundAmountGbp = round2(unitGross * input.quantityReturned)

  const settings = await prisma.storeSettings.findUnique({ where: { id: 'store' } })
  let restockCost = 0

  const refund = await prisma.$transaction(async (tx) => {
    restockCost = 0

    const refundPayment = await tx.salesPayment.create({
      data: {
        soId: input.originalOrderId,
        soItemId: input.originalLineId,
        quantityReturned: input.quantityReturned,
        amount: -refundAmountGbp,
        method: 'REFUND',
        reference: input.reason.substring(0, 100),
        status: 'COMPLETED',
        paidAt: new Date(),
      },
    })

    if (lineItem.itemId) {
      let warehouseId = settings?.posWarehouseId ?? null
      let unitCost = 0
      if (warehouseId) {
        const at = await tx.warehouseStock.findUnique({
          where: { warehouseId_itemId: { warehouseId, itemId: lineItem.itemId } },
        })
        if (!at) warehouseId = null
        else unitCost = Number(at.avgCost)
      }
      if (!warehouseId) {
        const top = await tx.warehouseStock.findFirst({
          where: { itemId: lineItem.itemId },
          orderBy: { quantity: 'desc' },
        })
        warehouseId = top?.warehouseId ?? null
        if (top) unitCost = Number(top.avgCost)
      }
      if (warehouseId) {
        await tx.warehouseStock.upsert({
          where: { warehouseId_itemId: { warehouseId, itemId: lineItem.itemId } },
          create: { warehouseId, itemId: lineItem.itemId, quantity: input.quantityReturned, avgCost: unitCost },
          update: { quantity: { increment: input.quantityReturned } },
        })
        await tx.stockLedger.create({
          data: {
            itemId: lineItem.itemId,
            warehouseId,
            transactionType: 'IN',
            quantity: input.quantityReturned,
            unitCost,
            totalCost: round2(unitCost * input.quantityReturned),
            referenceType: 'POS_RETURN',
            referenceId: refundPayment.id,
            notes: `POS return of order #${input.originalOrderId}`,
            transactionDate: new Date(),
          },
        })
        restockCost = round2(unitCost * input.quantityReturned)
      }
    } else if (lineItem.batchId != null) {
      await tx.inventoryBatch.update({
        where: { id: lineItem.batchId },
        data: { quantityOnHand: { increment: input.quantityReturned } },
      })
    }

    return refundPayment
  })

  const refundNet = round2(unitNet * input.quantityReturned)
  eventBus.emit('pos.return_processed', {
    returnId: refund.id,
    orderId: input.originalOrderId,
    refundGross: refundAmountGbp,
    refundNet,
    refundVat: round2(refundAmountGbp - refundNet),
    restockCost,
    userId: input.userId ?? 'system',
  })

  return refund
}

// ── Standard Order ──────────────────────────────────────────────────────

export interface StandardLineItemInput {
  itemId?: string
  description: string
  quantity: number
  unitPrice: number
  discount?: number
  taxRate?: number
}

export interface StandardOrderInput {
  customerId: string
  companyId?: string | null
  orderDate: string
  deliveryDate?: string | null
  notes?: string | null
  lineItems: StandardLineItemInput[]
}

export interface ShortfallItem {
  itemId: string
  description: string
  qty: number
  available: number
}

export async function createStandardOrder(
  input: StandardOrderInput,
): Promise<{ order: any; shortfall: ShortfallItem[] }> {
  const processedItems = input.lineItems.map((li) => {
    const totalPrice = li.quantity * li.unitPrice * (1 - (li.discount ?? 0) / 100) * (1 + (li.taxRate ?? 0) / 100)
    return {
      itemId: li.itemId ?? null,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      discount: li.discount ?? 0,
      taxRate: li.taxRate ?? 0,
      totalPrice,
    }
  })

  const subTotal = processedItems.reduce((s, li) => s + li.totalPrice, 0)
  const taxAmount = processedItems.reduce((s, li) => s + li.quantity * li.unitPrice * (li.taxRate / 100), 0)
  const discountAmount = processedItems.reduce(
    (s, li) => s + li.quantity * li.unitPrice * (li.discount / 100),
    0,
  )
  const totalAmount = subTotal + taxAmount - discountAmount

  const soNumber = await nextDocNumber('sales_order')

  const order = await prisma.$transaction(async (tx) => {
    return salesRepository.createStandardOrder(tx, {
      soNumber,
      customerId: input.customerId,
      companyId: input.companyId ?? null,
      orderDate: new Date(input.orderDate),
      deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null,
      notes: input.notes ?? null,
      lineItems: processedItems,
      subTotal,
      taxAmount,
      discountAmount,
      totalAmount,
    })
  })

  const shortfall: ShortfallItem[] = []
  const itemIds = [...new Set(input.lineItems.filter((li) => li.itemId).map((li) => li.itemId!))]
  if (itemIds.length > 0) {
    const allStocks = await prisma.warehouseStock.findMany({
      where: { itemId: { in: itemIds } },
    })
    const stockByItem = new Map<string, typeof allStocks>()
    for (const s of allStocks) {
      if (!stockByItem.has(s.itemId)) stockByItem.set(s.itemId, [])
      stockByItem.get(s.itemId)!.push(s)
    }

    for (const li of input.lineItems) {
      if (!li.itemId) continue
      const warehouseStocks = stockByItem.get(li.itemId) || []
      const totalAvailable = warehouseStocks.reduce((s, ws) => s + Number(ws.quantity), 0)
      const needed = Number(li.quantity)
      if (needed > totalAvailable) {
        shortfall.push({
          itemId: li.itemId,
          description: li.description,
          qty: needed,
          available: totalAvailable,
        })
      }
    }
  }

  return { order, shortfall }
}

// ── Order Retrieval ─────────────────────────────────────────────────────

async function getRefundsByLineItem(orderId: string): Promise<Map<string, number>> {
  const refunds = await prisma.salesPayment.findMany({
    where: { soId: orderId, method: 'REFUND', soItemId: { not: null } },
    select: { soItemId: true, quantityReturned: true },
  })
  const map = new Map<string, number>()
  for (const r of refunds) {
    const soItemId = r.soItemId!
    map.set(soItemId, (map.get(soItemId) ?? 0) + (r as any).quantityReturned)
  }
  return map
}

export async function getPosOrder(orderId: string) {
  const order = await prisma.salesOrderV2.findFirst({
    where: {
      OR: [
        { id: orderId },
        ...(isNaN(Number(orderId)) ? [] : [{ legacyRetailId: Number(orderId) }]),
      ],
    },
    include: {
      customer: true,
      lineItems: {
        include: { item: true },
      },
    },
  })
  if (!order) return null

  // Collect refunds from SalesPayment (stored on the new unified table)
  const refundsByLine = await getRefundsByLineItem(order.id)

  return {
    ...order,
    lineItems: order.lineItems.map((li) => ({
      ...li,
      returns: refundsByLine.has(li.id)
        ? [{ quantityReturned: refundsByLine.get(li.id)! }]
        : [],
    })),
  }
}

export function listPosOrders(date?: string | null) {
  const where: Record<string, unknown> = { channel: 'POS' }
  if (date) {
    where.orderDate = {
      gte: new Date(date + 'T00:00:00Z'),
      lte: new Date(date + 'T23:59:59Z'),
    }
  }
  return prisma.salesOrderV2.findMany({
    where: where as any,
    include: { customer: true, lineItems: { include: { item: true } } },
    orderBy: { orderDate: 'desc' },
    take: 50,
  })
}
