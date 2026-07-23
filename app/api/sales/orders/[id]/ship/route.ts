import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nextCustomerInvoiceNumber } from '@/lib/codes'
import { eventBus } from '@/lib/events/bus'
import { withAuth } from '@/lib/api-middleware'

type Params = { params: { id: string } }

export const POST = withAuth<Params>(async (_req: NextRequest, { params }) => {
  try {
    const order = await prisma.salesOrder.findUnique({
      where: { id: params.id },
      include: { lineItems: true, reservations: { where: { status: 'ACTIVE' } } },
    })
    if (!order) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    if (order.status !== 'PACKED')
      return NextResponse.json({ success: false, error: 'Order must be PACKED before shipping' }, { status: 400 })

    const invoiceNumber = await nextCustomerInvoiceNumber()
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    const today = new Date()

    const result = await prisma.$transaction(async (tx) => {
      // Create invoice
      const invoice = await tx.customerInvoice.create({
        data: {
          invoiceNumber,
          customerId: order.customerId,
          soId: order.id,
          invoiceDate: today,
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

      // Fulfill reservations: deduct from WarehouseStock and log in StockLedger
      const resIds = order.reservations.map(r => r.id)
      await tx.stockReservation.updateMany({
        where: { id: { in: resIds } },
        data: { status: 'FULFILLED' },
      })
      await tx.stockLedger.createMany({
        data: order.reservations.map(res => ({
          itemId: res.itemId,
          warehouseId: res.warehouseId,
          transactionType: 'OUT',
          quantity: res.reservedQty,
          unitCost: 0,
          totalCost: 0,
          referenceType: 'SO',
          referenceId: order.id,
          notes: `Shipped on Sales Order ${order.soNumber}`,
          transactionDate: today,
        })),
      })
      for (const res of order.reservations) {
        await tx.warehouseStock.updateMany({
          where: { itemId: res.itemId, warehouseId: res.warehouseId },
          data: { quantity: { decrement: res.reservedQty } },
        })
      }

      // Move SO to SHIPPED
      await tx.salesOrder.update({
        where: { id: params.id },
        data: { status: 'SHIPPED' },
      })

      return invoice
    })

    // Check reorder levels for shipped items (best-effort, after transaction)
    const uniqueItemIds = Array.from(new Set(order.reservations.map((r) => r.itemId)))
    for (const itemId of uniqueItemIds) {
      const [stocks, item] = await Promise.all([
        prisma.warehouseStock.findMany({ where: { itemId } }),
        prisma.item.findUnique({ where: { id: itemId }, select: { id: true, name: true, sku: true, reorderPoint: true } }),
      ])
      if (!item || !item.reorderPoint) continue
      const totalQty = stocks.reduce((s, ws) => s + Number(ws.quantity), 0)
      if (totalQty <= Number(item.reorderPoint)) {
        eventBus.emit('stock.below_reorder', {
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          currentQty: totalQty,
          reorderPoint: Number(item.reorderPoint),
        })
      }
    }

    return NextResponse.json({ success: true, data: { invoice: result, status: 'SHIPPED' } }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
