import { Prisma, SalesOrderStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { calcLineTotal, calcOrderTotals } from '@/lib/money'
import { nextDocNumber } from '@/lib/services/numbering'
import { nextPurchaseRequestNumber } from '@/lib/codes'
import { decrementStock } from '@/lib/stock'

export interface LineItemInput {
  itemId?: string
  description: string
  quantity: number
  unitPrice: number
  discount?: number
  taxRate?: number
}

export interface CreateSalesOrderInput {
  customerId: string
  orderDate: Date
  deliveryDate?: Date | null
  notes?: string | null
  lineItems: LineItemInput[]
  companyId?: string | null
  quotationId?: string | null
}

export interface ShortfallItem {
  itemId: string
  description: string
  qty: number
  available: number
}

const orderIncludes = {
  customer: { select: { id: true, name: true } },
  lineItems: { include: { item: { select: { id: true, name: true, sku: true } } } },
} as const

const singleOrderIncludes = {
  customer: true,
  lineItems: true,
  quotation: { select: { id: true, quotationNumber: true } },
  invoices: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
  reservations: { where: { status: 'ACTIVE' }, select: { id: true, itemId: true, warehouseId: true, reservedQty: true } },
  requisitions: { select: { id: true, prNumber: true, status: true }, orderBy: { createdAt: 'desc' as const }, take: 1 },
} as const

function processLineItems(items: LineItemInput[]) {
  const lineCalcs = items.map((li) => calcLineTotal({
    quantity: li.quantity, unitPrice: li.unitPrice,
    discountPct: li.discount, taxRate: li.taxRate,
  }))
  const processedItems = items.map((li, i) => ({
    itemId: li.itemId ?? undefined,
    description: li.description,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    discount: li.discount ?? 0,
    taxRate: li.taxRate ?? 0,
    totalPrice: lineCalcs[i].grossTotal,
  }))
  const { subTotal, totalTax: taxAmount, totalDiscount: discountAmount, grandTotal: totalAmount } = calcOrderTotals(lineCalcs)
  return { processedItems, subTotal, taxAmount, discountAmount, totalAmount }
}

export async function createSalesOrder(
  tx: Prisma.TransactionClient,
  input: CreateSalesOrderInput,
): Promise<{
  order: Prisma.SalesOrderGetPayload<{ include: typeof orderIncludes }>
  shortfall: ShortfallItem[]
}> {
  const { processedItems, subTotal, taxAmount, discountAmount, totalAmount } = processLineItems(input.lineItems)
  const soNumber = await nextDocNumber('sales_order')

  const order = await tx.salesOrder.create({
    data: {
      soNumber,
      customerId: input.customerId,
      companyId: input.companyId ?? undefined,
      quotationId: input.quotationId ?? undefined,
      orderDate: input.orderDate,
      deliveryDate: input.deliveryDate ?? undefined,
      notes: input.notes ?? undefined,
      subTotal,
      taxAmount,
      discountAmount,
      totalAmount,
      lineItems: { create: processedItems },
    },
    include: orderIncludes,
  })

  // Check inventory availability
  const shortfall: ShortfallItem[] = []
  const itemIds = [...new Set(input.lineItems.filter(li => li.itemId).map(li => li.itemId!))]
  if (itemIds.length > 0) {
    const allStocks = await tx.warehouseStock.findMany({ where: { itemId: { in: itemIds } } })
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
        shortfall.push({ itemId: li.itemId, description: li.description, qty: needed, available: totalAvailable })
      }
    }
  }

  return { order, shortfall }
}

export async function getSalesOrder(id: string) {
  return prisma.salesOrder.findUnique({
    where: { id },
    include: singleOrderIncludes,
  })
}

export async function listSalesOrders(where: { deletedAt?: Date | null; companyId?: string | null }) {
  return prisma.salesOrder.findMany({
    where: { deletedAt: null, ...(where.companyId ? { companyId: where.companyId } : {}) },
    include: orderIncludes,
    orderBy: { orderDate: 'desc' },
    take: 100,
  })
}

const validTransitions: Record<string, string[]> = {
  DRAFT: ['CONFIRMED'],
  CONFIRMED: ['RESERVED', 'PENDING_PO'],
  PENDING_PO: ['RESERVED', 'CANCELLED'],
  RESERVED: ['PICKING', 'CREDIT_HOLD'],
  CREDIT_HOLD: ['PICKING'],
  PICKING: ['PACKED'],
  PACKED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

export function validateStatusTransition(current: string, next: string): string | null {
  const allowed = validTransitions[current]
  if (!allowed) return `Unknown status: ${current}`
  if (!allowed.includes(next)) return `Cannot transition from ${current} to ${next}`
  return null
}

export async function checkInventoryAndReserve(
  tx: Prisma.TransactionClient,
  orderId: string,
  soNumber: string,
  customerId: string,
  lineItems: Array<{ id: string; itemId: string | null; description: string; quantity: number | Prisma.Decimal }>,
  deliveryDate?: Date | null,
): Promise<{
  status: SalesOrderStatus
  shortfall: Array<{ itemId: string; description: string; qty: number; soItemId: string }>
  prId?: string
  prNumber?: string
}> {
  // Release prior ACTIVE reservations
  await tx.stockReservation.updateMany({
    where: { soId: orderId, status: 'ACTIVE' },
    data: { status: 'RELEASED' },
  })

  const shortfall: Array<{ itemId: string; description: string; qty: number; soItemId: string }> = []
  const reservationsToCreate: Array<{
    soId: string; soItemId: string; itemId: string; warehouseId: string; reservedQty: number
  }> = []

  for (const li of lineItems) {
    if (!li.itemId) continue
    const needed = Number(li.quantity)

    const warehouseStocks = await tx.warehouseStock.findMany({
      where: { itemId: li.itemId },
      include: { warehouse: { select: { id: true } } },
    })

    const alreadyReserved = await tx.stockReservation.aggregate({
      where: { itemId: li.itemId, status: 'ACTIVE' },
      _sum: { reservedQty: true },
    })
    const reservedElsewhere = Number(alreadyReserved._sum.reservedQty ?? 0)

    let remaining = needed
    for (const ws of warehouseStocks) {
      if (remaining <= 0) break
      const available = Math.max(0, Number(ws.quantity) - (ws.warehouseId === warehouseStocks[0]?.warehouseId ? reservedElsewhere : 0))
      const allocate = Math.min(available, remaining)
      if (allocate > 0) {
        reservationsToCreate.push({
          soId: orderId,
          soItemId: li.id,
          itemId: li.itemId,
          warehouseId: ws.warehouseId,
          reservedQty: allocate,
        })
        remaining -= allocate
      }
    }

    if (remaining > 0) {
      shortfall.push({ itemId: li.itemId, description: li.description, qty: remaining, soItemId: li.id })
    }
  }

  if (shortfall.length === 0) {
    await tx.stockReservation.createMany({ data: reservationsToCreate })
    await tx.salesOrder.update({ where: { id: orderId }, data: { status: 'RESERVED' } })
    return { status: 'RESERVED', shortfall: [] }
  }

  // Create purchase requisition for shortfall
  const prNumber = await nextPurchaseRequestNumber()
  const pr = await tx.purchaseRequisition.create({
    data: {
      prNumber,
      requestedById: 'system',
      sourceSoId: orderId,
      requiredDate: deliveryDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: `Auto-generated from Sales Order ${soNumber} — stock shortfall`,
      totalAmount: 0,
      lineItems: {
        create: shortfall.map((s) => ({
          itemId: s.itemId,
          description: s.description,
          quantity: s.qty,
          uom: 'EA',
          estimatedUnitPrice: 0,
          totalPrice: 0,
        })),
      },
    },
  })

  await tx.salesOrder.update({ where: { id: orderId }, data: { status: 'PENDING_PO' } })
  return { status: 'PENDING_PO', shortfall, prId: pr.id, prNumber: pr.prNumber }
}

// ── Quotations ───────────────────────────────────────────────────────────

const quotationIncludes = {
  customer: { select: { id: true, name: true } },
  lineItems: true,
} as const

export function listQuotations() {
  return prisma.quotation.findMany({
    where: { deletedAt: null },
    include: quotationIncludes,
    orderBy: { quotationDate: 'desc' },
    take: 100,
  })
}

export async function createQuotation(data: {
  customerId: string
  quotationDate: Date
  expiryDate: Date
  notes?: string | null
  lineItems: LineItemInput[]
}) {
  const quotationNumber = await nextDocNumber('quotation')
  const { processedItems, subTotal, taxAmount, discountAmount, totalAmount } = processLineItems(data.lineItems)

  return prisma.quotation.create({
    data: {
      quotationNumber,
      customerId: data.customerId,
      quotationDate: data.quotationDate,
      expiryDate: data.expiryDate,
      notes: data.notes ?? null,
      subTotal,
      taxAmount,
      discountAmount,
      totalAmount,
      lineItems: { create: processedItems },
    },
    include: quotationIncludes,
  })
}

export function getQuotation(id: string) {
  return prisma.quotation.findUnique({
    where: { id },
    include: { customer: true, lineItems: true, salesOrder: { select: { id: true, soNumber: true } } },
  })
}

export async function convertQuotationToOrder(tx: Prisma.TransactionClient, quotation: {
  id: string
  customerId: string
  lineItems: Array<{
    itemId: string | null
    description: string
    quantity: number | Prisma.Decimal
    unitPrice: number | Prisma.Decimal
    discount: number | Prisma.Decimal
    taxRate: number | Prisma.Decimal
  }>
}) {
  const { order } = await createSalesOrder(tx, {
    customerId: quotation.customerId,
    orderDate: new Date(),
    lineItems: quotation.lineItems.map((li) => ({
      itemId: li.itemId ?? undefined,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      discount: Number(li.discount),
      taxRate: Number(li.taxRate),
    })),
    quotationId: quotation.id,
  })
  await tx.quotation.update({ where: { id: quotation.id }, data: { status: 'ACCEPTED' } })
  return order
}

export function updateQuotation(id: string, data: Record<string, unknown>) {
  return prisma.quotation.update({ where: { id }, data: data as any })
}

export function softDeleteQuotation(id: string) {
  return prisma.quotation.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Shipping / Fulfillment ────────────────────────────────────────────────

export async function shipSalesOrder(
  tx: Prisma.TransactionClient,
  id: string,
  options: {
    order: {
      id: string
      customerId: string
      soNumber: string
      subTotal: Prisma.Decimal
      taxAmount: Prisma.Decimal
      discountAmount: Prisma.Decimal
      totalAmount: Prisma.Decimal
      notes: string | null
      lineItems: Array<{
        itemId: string | null
        description: string
        quantity: Prisma.Decimal
        unitPrice: Prisma.Decimal
        discount: Prisma.Decimal
        taxRate: Prisma.Decimal
        totalPrice: Prisma.Decimal
      }>
      reservations: Array<{ id: string; itemId: string; warehouseId: string; reservedQty: Prisma.Decimal }>
    }
    invoiceNumber: string
    dueDate: Date
    invoiceDate: Date
  },
) {
  const invoice = await convertToInvoice(tx, options.order, options.invoiceNumber, options.invoiceDate, options.dueDate)

  await tx.stockReservation.updateMany({
    where: { id: { in: options.order.reservations.map(r => r.id) } },
    data: { status: 'FULFILLED' },
  })
  for (const res of options.order.reservations) {
    await decrementStock(tx, res.itemId, res.warehouseId, Number(res.reservedQty), {
      referenceType: 'SO', referenceId: options.order.id,
      notes: `Shipped on Sales Order ${options.order.soNumber}`, transactionDate: options.invoiceDate,
    })
  }

  await tx.salesOrder.update({ where: { id }, data: { status: 'SHIPPED' } })
  return invoice
}

export async function convertToInvoice(
  tx: Prisma.TransactionClient,
  order: {
    id: string
    customerId: string
    subTotal: Prisma.Decimal
    taxAmount: Prisma.Decimal
    discountAmount: Prisma.Decimal
    totalAmount: Prisma.Decimal
    notes: string | null
    lineItems: Array<{
      itemId: string | null
      description: string
      quantity: Prisma.Decimal
      unitPrice: Prisma.Decimal
      discount: Prisma.Decimal
      taxRate: Prisma.Decimal
      totalPrice: Prisma.Decimal
    }>
  },
  invoiceNumber: string,
  invoiceDate: Date,
  dueDate: Date,
) {
  return tx.customerInvoice.create({
    data: {
      invoiceNumber,
      customerId: order.customerId,
      soId: order.id,
      invoiceDate,
      dueDate,
      subTotal: order.subTotal,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      notes: order.notes ?? undefined,
      lineItems: {
        create: order.lineItems.map((li) => ({
          itemId: li.itemId ?? undefined,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          discount: li.discount,
          taxRate: li.taxRate,
          totalPrice: li.totalPrice,
        })),
      },
    },
  })
}

export function updateSalesOrder(id: string, data: Record<string, unknown>) {
  return prisma.salesOrder.update({ where: { id }, data })
}

export function softDeleteSalesOrder(id: string) {
  return prisma.salesOrder.update({ where: { id }, data: { deletedAt: new Date() } })
}
