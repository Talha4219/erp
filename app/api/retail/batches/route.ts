import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { inventoryBatchSchema } from '@/lib/validations/retail'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  const expiryDays = searchParams.get('expiryDays')
  const lowStock = searchParams.get('lowStock') === 'true'

  try {
    if (lowStock) {
      const products = await prisma.item.findMany({
        where: { deletedAt: null },
        include: { batches: { where: { quantityOnHand: { gt: 0 } } } },
      })
      const lowStockProducts = products.filter((p) => {
        const totalQty = p.batches.reduce((sum: number, b: any) => sum + b.quantityOnHand, 0)
        return totalQty <= Number(p.reorderPoint ?? 0)
      })
      return NextResponse.json({ success: true, data: lowStockProducts })
    }

    if (expiryDays) {
      const days = parseInt(expiryDays)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + days)
      const batches = await prisma.inventoryBatch.findMany({
        where: {
          expiryDate: { lte: cutoff, gte: new Date() },
          quantityOnHand: { gt: 0 },
        },
        include: { item: { select: { id: true, name: true, sku: true, sellingPrice: true } } },
        orderBy: { expiryDate: 'asc' },
      })
      return NextResponse.json({ success: true, data: batches })
    }

    const batches = await prisma.inventoryBatch.findMany({
      where: productId ? { itemId: productId } : {},
      include: { item: { select: { id: true, name: true, sku: true, sellingPrice: true } } },
      orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
    })
    return NextResponse.json({ success: true, data: batches })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = inventoryBatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const { expiryDate, manufacturingDate, receivedDate, ...rest } = parsed.data
    const batch = await prisma.inventoryBatch.create({
      data: {
        ...rest,
        manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
      },
    })
    return NextResponse.json({ success: true, data: batch }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
