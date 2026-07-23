import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { returnRefundSchema } from '@/lib/validations/retail'
import { eventBus } from '@/lib/events/bus'
import { registerEventHandlers } from '@/lib/events/handlers'

registerEventHandlers() // idempotent — makes journal posting work even if no page rendered yet

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = returnRefundSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { originalOrderId, originalLineId, quantityReturned, reason } = parsed.data

  try {
    const lineItem = await (prisma as any)._retailSalesLineItem.findUnique({
      where: { id: originalLineId },
      include: { returns: true },
    })
    if (!lineItem) return NextResponse.json({ success: false, error: 'Line item not found' }, { status: 404 })

    // The line must actually belong to the order the client claims.
    if (lineItem.orderId !== originalOrderId) {
      return NextResponse.json({ success: false, error: 'Line item does not belong to this order' }, { status: 400 })
    }

    // Can't return more than was sold, across all prior returns for this line.
    const alreadyReturned = lineItem.returns.reduce((s: number, r: any) => s + r.quantityReturned, 0)
    const returnable = lineItem.quantity - alreadyReturned
    if (quantityReturned > returnable) {
      return NextResponse.json({
        success: false,
        error: `Only ${returnable} unit(s) remain returnable on this line`,
      }, { status: 400 })
    }

    // Refund is derived from the original line — the per-unit price net of its
    // share of the line discount, plus VAT. Never trust a client-sent amount.
    const unitPrice = Number(lineItem.unitPriceGbp)
    const unitDiscount = lineItem.quantity > 0 ? Number(lineItem.lineDiscountGbp) / lineItem.quantity : 0
    const unitNet = unitPrice - unitDiscount
    const unitGross = unitNet * (1 + Number(lineItem.vatRateApplied))
    const refundAmountGbp = round2(unitGross * quantityReturned)

    const settings = await prisma.storeSettings.findUnique({ where: { id: 'store' } })

    // Captured for the post-commit finance event (transactions can retry, so reset inside).
    let restockCost = 0

    const returnRecord = await prisma.$transaction(async (tx) => {
      restockCost = 0
      const refund = await (tx as any)._returnRefund.create({
        data: { originalOrderId, originalLineId, quantityReturned, refundAmountGbp, reason },
      })

      const itemId = lineItem.itemId
      if (itemId) {
        // POS sale of an inventory Item: restock its warehouseStock — the configured
        // POS warehouse if the item is stocked there, else the one holding the most.
        let warehouseId = settings?.posWarehouseId ?? null
        let unitCost = 0
        if (warehouseId) {
          const at = await tx.warehouseStock.findUnique({
            where: { warehouseId_itemId: { warehouseId, itemId } },
          })
          if (!at) warehouseId = null
          else unitCost = Number(at.avgCost)
        }
        if (!warehouseId) {
          const top = await tx.warehouseStock.findFirst({ where: { itemId }, orderBy: { quantity: 'desc' } })
          warehouseId = top?.warehouseId ?? null
          if (top) unitCost = Number(top.avgCost)
        }
        if (warehouseId) {
          await tx.warehouseStock.upsert({
            where: { warehouseId_itemId: { warehouseId, itemId } },
            create: { warehouseId, itemId, quantity: quantityReturned, avgCost: unitCost },
            update: { quantity: { increment: quantityReturned } },
          })
          // Mirror the restock into the inventory ledger (IN, signed positive) so
          // POS returns show up in inventory history and valuation.
          await tx.stockLedger.create({
            data: {
              itemId,
              warehouseId,
              transactionType: 'IN',
              quantity: quantityReturned,
              unitCost,
              totalCost: round2(unitCost * quantityReturned),
              referenceType: 'POS_RETURN',
              referenceId: String(refund.id),
              notes: `POS return of order #${originalOrderId}`,
              transactionDate: new Date(),
            },
          })
          restockCost = round2(unitCost * quantityReturned)
        }
      } else if (lineItem.batchId != null) {
        // Legacy retail product sale with no inventory link: restock its batch directly.
        await tx.inventoryBatch.update({
          where: { id: lineItem.batchId },
          data: { quantityOnHand: { increment: quantityReturned } },
        })
      }

      return refund
    })

    // Post-commit: reverse the sale's revenue/VAT (and COGS when restocked) in finance.
    const refundNet = round2(unitNet * quantityReturned)
    eventBus.emit('pos.return_processed', {
      returnId: returnRecord.id,
      orderId: originalOrderId,
      refundGross: refundAmountGbp,
      refundNet,
      refundVat: round2(refundAmountGbp - refundNet),
      restockCost,
      userId: session.user.id!,
    })

    return NextResponse.json({ success: true, data: returnRecord }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
