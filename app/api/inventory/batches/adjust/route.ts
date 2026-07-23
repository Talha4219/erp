import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { itemBatchAdjustSchema } from '@/lib/validations/inventory'

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = itemBatchAdjustSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const { batchId, quantityChange, reason, adjustedBy } = parsed.data
    const batch = await prisma.inventoryBatch.findUnique({ where: { id: batchId } })
    if (!batch) return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })

    const newQty = batch.quantityOnHand + quantityChange
    if (newQty < 0)
      return NextResponse.json({ success: false, error: 'Adjustment would result in negative stock' }, { status: 400 })

    await prisma.$transaction([
      prisma.inventoryBatch.update({ where: { id: batchId }, data: { quantityOnHand: newQty } }),
      prisma.stockAdjustment.create({ data: { batchId, quantityChange, reason, adjustedBy } }),
    ])

    return NextResponse.json({ success: true, data: { newQty } })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
