import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { hasModuleAccess } from '@/lib/authz'

export const GET = withAuth(async (_: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const cc = await prisma.cycleCount.findUnique({
    where: { id: params.id },
    include: { warehouse: true, lineItems: { include: { item: true } } },
  })
  if (!cc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: cc })
})

export const PUT = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const { action, lineItems } = body

  const cc = await prisma.cycleCount.findUnique({ where: { id: params.id }, include: { lineItems: true } })
  if (!cc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  if (action === 'update-counts') {
    // Update countedQty and variance for each line in a single transaction
    const updates = (lineItems as { id: string; countedQty: number }[])
    const systemQtyMap = new Map(cc.lineItems.map(l => [l.id, Number(l.systemQty)]))
    await prisma.$transaction(
      updates.map((u) =>
        prisma.cycleCountItem.update({
          where: { id: u.id },
          data: { countedQty: u.countedQty, variance: u.countedQty - (systemQtyMap.get(u.id) ?? 0) },
        })
      )
    )
    const updated = await prisma.cycleCount.update({ where: { id: params.id }, data: { status: 'IN_PROGRESS' } })
    return NextResponse.json({ success: true, data: updated })
  }

  if (action === 'complete') {
    if (cc.status === 'COMPLETED')
      return NextResponse.json({ success: false, error: 'Already completed' }, { status: 400 })
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Apply variances as adjustments
        const varianceLines = cc.lineItems.filter(
          l => l.countedQty !== null && l.variance !== null && Number(l.variance) !== 0
        )
        await tx.stockLedger.createMany({
          data: varianceLines.map(line => ({
            itemId: line.itemId, warehouseId: cc.warehouseId,
            transactionType: 'ADJUSTMENT', quantity: Number(line.variance),
            unitCost: 0, totalCost: 0,
            referenceType: 'CYCLE_COUNT', referenceId: cc.id,
            notes: `Cycle Count ${cc.countNumber}`,
            transactionDate: cc.countDate,
          })),
        })
        for (const line of varianceLines) {
          await tx.warehouseStock.upsert({
              where: { warehouseId_itemId: { warehouseId: cc.warehouseId, itemId: line.itemId } },
              create: { warehouseId: cc.warehouseId, itemId: line.itemId, quantity: Number(line.variance), avgCost: 0 },
              update: { quantity: { increment: Number(line.variance ?? 0) } },
            })
        }
        return tx.cycleCount.update({ where: { id: params.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
      })
      return NextResponse.json({ success: true, data: result })
    } catch (err) {
      return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
    }
  }

  if (action === 'cancel') {
    if (cc.status === 'COMPLETED')
      return NextResponse.json({ success: false, error: 'Cannot cancel a completed count' }, { status: 400 })
    const result = await prisma.cycleCount.update({ where: { id: params.id }, data: { status: 'CANCELLED' } })
    return NextResponse.json({ success: true, data: result })
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
})
