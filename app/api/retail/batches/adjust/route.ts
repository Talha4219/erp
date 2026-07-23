import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { stockAdjustmentRetailSchema } from '@/lib/validations/retail'

export const POST = withAuth(async (req: NextRequest, { session }) => {
  const body = await req.json()
  const parsed = stockAdjustmentRetailSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const batch = await prisma.inventoryBatch.findUnique({ where: { id: parsed.data.batchId } })
    if (!batch) return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })

    const newQty = batch.quantityOnHand + parsed.data.quantityChange
    if (newQty < 0) {
      return NextResponse.json({ success: false, error: 'Insufficient stock' }, { status: 400 })
    }

    const [adjustment] = await prisma.$transaction([
      prisma.stockAdjustment.create({
        data: {
          batchId: parsed.data.batchId,
          quantityChange: parsed.data.quantityChange,
          reason: parsed.data.reason,
          adjustedBy: parsed.data.adjustedBy ?? (session.user as { name?: string }).name ?? 'System',
        },
      }),
      prisma.inventoryBatch.update({
        where: { id: parsed.data.batchId },
        data: { quantityOnHand: newQty },
      }),
    ])

    await prisma.auditLog.create({
      data: {
        userId: (session.user as { id: string }).id,
        action: 'STOCK_ADJUSTMENT',
        entity: 'InventoryBatch',
        entityId: String(parsed.data.batchId),
        oldValues: { quantityOnHand: batch.quantityOnHand },
        newValues: { quantityOnHand: newQty, reason: parsed.data.reason },
      },
    })

    return NextResponse.json({ success: true, data: adjustment }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
