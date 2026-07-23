import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { itemBatchSchema } from '@/lib/validations/inventory'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('itemId')
  const expiryDays = searchParams.get('expiryDays')
  const lowStock = searchParams.get('lowStock') === 'true'

  try {
    if (lowStock) {
      const items = await prisma.item.findMany({
        where: { deletedAt: null, isActive: true },
        include: {
          batches: { where: { quantityOnHand: { gt: 0 } }, select: { quantityOnHand: true } },
          category: { select: { name: true } },
        },
      })
      const result = items
        .map((item) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category?.name ?? '—',
          reorderPoint: Number(item.reorderPoint),
          totalQty: item.batches.reduce((s, b) => s + b.quantityOnHand, 0),
        }))
        .filter((i) => i.totalQty <= i.reorderPoint)
      return NextResponse.json({ success: true, data: result })
    }

    const where: Record<string, unknown> = {}
    if (itemId) where.itemId = itemId
    if (expiryDays) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + parseInt(expiryDays))
      where.expiryDate = { lte: cutoff, gte: new Date() }
      where.quantityOnHand = { gt: 0 }
    }

    const batches = await prisma.inventoryBatch.findMany({
      where,
      include: {
        item: {
          select: { id: true, sku: true, name: true, uom: true, reorderPoint: true },
        },
      },
      orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
    })
    return NextResponse.json({ success: true, data: batches })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = itemBatchSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const { expiryDate, manufacturingDate, receivedDate, ...rest } = parsed.data
    const batch = await prisma.inventoryBatch.create({
      data: {
        ...rest,
        manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
      },
      include: { item: { select: { id: true, sku: true, name: true, packing: true } } },
    })
    return NextResponse.json({ success: true, data: batch }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
