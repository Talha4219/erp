import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

export const GET = withAuth(async (_: NextRequest, { params, session }: { params: { id: string } } & { session: import('@/lib/api-middleware').AuthedSession }) => {
  if (!hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: params.id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      lineItems: { include: { item: true } },
    },
  })
  if (!transfer) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: transfer })
})

export const PUT = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: import('@/lib/api-middleware').AuthedSession }) => {
  if (!hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const { action } = body // 'post' | 'cancel'

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: params.id },
    include: { lineItems: true },
  })
  if (!transfer) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  if (action === 'post') {
    if (transfer.status !== 'DRAFT' && transfer.status !== 'IN_TRANSIT')
      return NextResponse.json({ success: false, error: 'Cannot post in current status' }, { status: 400 })

    try {
      const result = await prisma.$transaction(async (tx) => {
        const txnDate = transfer.transferDate
        const fromWh = transfer.fromWarehouseId
        const toWh = transfer.toWarehouseId
        // WarehouseStock adjustments per line (upsert required — unique per (wh, item))
        for (const line of transfer.lineItems) {
          const qty = Number(line.quantity)
          const cost = Number(line.unitCost)
          await tx.warehouseStock.upsert({
            where: { warehouseId_itemId: { warehouseId: fromWh, itemId: line.itemId } },
            create: { warehouseId: fromWh, itemId: line.itemId, quantity: -qty, avgCost: cost },
            update: { quantity: { decrement: qty } },
          })
          await tx.warehouseStock.upsert({
            where: { warehouseId_itemId: { warehouseId: toWh, itemId: line.itemId } },
            create: { warehouseId: toWh, itemId: line.itemId, quantity: qty, avgCost: cost },
            update: { quantity: { increment: qty } },
          })
        }
        // Ledger entries — can batch since all share same reference
        await tx.stockLedger.createMany({
          data: transfer.lineItems.flatMap(line => [
            {
              itemId: line.itemId, warehouseId: fromWh,
              transactionType: 'TRANSFER', quantity: -Number(line.quantity),
              unitCost: Number(line.unitCost), totalCost: Number(line.quantity) * Number(line.unitCost),
              referenceType: 'TRANSFER', referenceId: transfer.id,
              transactionDate: txnDate,
            },
            {
              itemId: line.itemId, warehouseId: toWh,
              transactionType: 'TRANSFER', quantity: Number(line.quantity),
              unitCost: Number(line.unitCost), totalCost: Number(line.quantity) * Number(line.unitCost),
              referenceType: 'TRANSFER', referenceId: transfer.id,
              transactionDate: txnDate,
            },
          ]),
        })
        return tx.stockTransfer.update({ where: { id: params.id }, data: { status: 'COMPLETED' } })
      })
      return NextResponse.json({ success: true, data: result })
    } catch (err) {
      return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
    }
  }

  if (action === 'cancel') {
    if (transfer.status === 'COMPLETED')
      return NextResponse.json({ success: false, error: 'Cannot cancel a completed transfer' }, { status: 400 })
    const result = await prisma.stockTransfer.update({ where: { id: params.id }, data: { status: 'CANCELLED' } })
    return NextResponse.json({ success: true, data: result })
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
})
