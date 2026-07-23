import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { getStripe, stripeBreaker } from '@/lib/stripe'
import { posOrderSchema } from '@/lib/validations/retail'
import { eventBus } from '@/lib/events/bus'
import { registerEventHandlers } from '@/lib/events/handlers'

registerEventHandlers() // idempotent — makes journal posting work even if no page rendered yet

// Round to whole pennies (half-up) to avoid floating-point drift in money totals.
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const orderId = searchParams.get('orderId')

  try {
    // Single-order lookup (used by the returns flow) includes prior returns per line
    // so the UI can show how much of each line is still returnable.
    if (orderId) {
      const id = Number(orderId)
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid orderId' }, { status: 400 })
      }
      const order = await (prisma as any)._retailSalesOrder.findUnique({
        where: { id },
        include: {
          customer: true,
          lineItems: { include: { item: true, product: true, returns: true } },
        },
      })
      if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
      return NextResponse.json({ success: true, data: order })
    }

    const whereDate = date
      ? { transactionDate: { gte: new Date(date + 'T00:00:00Z'), lte: new Date(date + 'T23:59:59Z') } }
      : {}

    const orders = await (prisma as any)._retailSalesOrder.findMany({
      where: whereDate,
      include: { customer: true, lineItems: { include: { item: true, product: true } }, returns: true },
      orderBy: { transactionDate: 'desc' },
      take: 50,
    })
    return NextResponse.json({ success: true, data: orders })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = posOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { customerId, paymentMethod, stripePaymentIntentId, lineItems } = parsed.data

  try {
    // POS sells inventory Items directly. Load authoritative price/VAT for every
    // line in one query; only sellable items may be sold.
    const itemIds = Array.from(new Set(lineItems.map((li) => li.itemId)))
    const items = await prisma.item.findMany({ where: { id: { in: itemIds }, deletedAt: null } })
    const itemById = new Map(items.map((i) => [i.id, i]))
    const settings = await prisma.storeSettings.findUnique({ where: { id: 'store' } })

    // Recompute all money server-side; never trust client-supplied totals or prices.
    const computedLines = lineItems.map((li) => {
      const item = itemById.get(li.itemId)
      if (!item) throw new Error(`Item ${li.itemId} not found`)
      if (!item.isActive || !item.isSellable) throw new Error(`${item.name} is not available for sale`)
      const unitPrice = Number(item.sellingPrice)
      const vatRate = Number(item.vatRate)
      const gross = round2(unitPrice * li.quantity)
      const discount = Math.min(round2(li.lineDiscountGbp), gross) // discount can't exceed the line
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

    const totalDiscountGbp = round2(computedLines.reduce((s: number, l: any) => s + l.lineDiscountGbp, 0))
    const netTotalGbp = round2(computedLines.reduce((s: number, l: any) => s + l._net, 0))
    const vatAmountGbp = round2(computedLines.reduce((s: number, l: any) => s + l._vat, 0))
    const grandTotalGbp = round2(netTotalGbp + vatAmountGbp)

    // For card payments, verify the Stripe PaymentIntent is valid before proceeding.
    let stripePaymentStatus: string | undefined
    if (paymentMethod === 'Card' && stripePaymentIntentId) {
      const pi = await stripeBreaker.call(() =>
        getStripe().paymentIntents.retrieve(stripePaymentIntentId)
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

    // Resolved outside the transaction closure so the post-commit finance event
    // can compute COGS from the same figures the ledger was written with.
    const stockMoves: { itemId: string; warehouseId: string; quantity: number; unitCost: number }[] = []

    const order = await prisma.$transaction(async (tx) => {
      // Resolve the sale warehouse + unit cost per line so we can both decrement
      // on-hand stock and write the inventory ledger entry after the order exists.
      stockMoves.length = 0 // transactions can retry — don't double-count moves

      // Decrement stock atomically. Conditional updateMany (qty >= needed) closes
      // the check-then-decrement race: if two sales hit the same stock, one wins.
      for (const l of computedLines) {
        const item = itemById.get(l.itemId)!
        // warehouseStock is the source of truth. Pick the configured POS warehouse
        // if the item is stocked there, else the one holding the most of this item.
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
            where: { itemId: l.itemId }, orderBy: { quantity: 'desc' },
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

      const newOrder = await (tx as any)._retailSalesOrder.create({
        data: {
          customerId: customerId ?? null,
          paymentMethod,
          stripePaymentIntentId: stripePaymentIntentId ?? null,
          stripePaymentStatus,
          totalDiscountGbp,
          netTotalGbp,
          vatAmountGbp,
          grandTotalGbp,
          lineItems: {
            create: computedLines.map((l) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              unitPriceGbp: l.unitPriceGbp,
              lineDiscountGbp: l.lineDiscountGbp,
              vatRateApplied: l.vatRateApplied,
            })),
          },
        },
        include: { lineItems: true },
      })

      // Record the stock movement in the inventory ledger (OUT, signed negative)
      // so POS sales show up in inventory history and valuation.
      const saleDate = new Date()
      await tx.stockLedger.createMany({
        data: stockMoves.map(m => ({
          itemId: m.itemId,
          warehouseId: m.warehouseId,
          transactionType: 'OUT',
          quantity: -m.quantity,
          unitCost: m.unitCost,
          totalCost: round2(m.unitCost * m.quantity),
          referenceType: 'POS',
          referenceId: String(newOrder.id),
          notes: `POS sale #${newOrder.id}`,
          transactionDate: saleDate,
        })),
      })

      if (customerId) {
        const pointsEarned = Math.floor(grandTotalGbp)
        await tx.retailCustomer.update({
          where: { id: Number(customerId) },
          data: { loyaltyPointsBalance: { increment: pointsEarned } },
        })
      }

      return newOrder
    }, { isolationLevel: 'Serializable' })

    // Post-commit: hand the sale to finance (revenue + VAT + COGS journals).
    // Best-effort by design — a journal hiccup must never void a completed sale.
    const totalCost = round2(stockMoves.reduce((s: number, m: any) => s + m.unitCost * m.quantity, 0))
    eventBus.emit('pos.sale_completed', {
      orderId: order.id,
      netTotal: netTotalGbp,
      vatAmount: vatAmountGbp,
      grandTotal: grandTotalGbp,
      totalCost,
      paymentMethod,
      userId: session.user.id!,
    })

    // Link the Stripe PaymentIntent metadata to the order for webhook reconciliation.
    if (stripePaymentIntentId) {
      stripeBreaker.call(() =>
        getStripe().paymentIntents.update(stripePaymentIntentId, {
          metadata: { posOrderId: String(order.id) },
        })
      ).catch(() => {
        // non-critical — best-effort (already handled by the breaker)
      })
    }

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 400 })
  }
})
