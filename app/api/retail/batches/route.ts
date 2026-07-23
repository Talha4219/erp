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
      const products = await prisma.product.findMany({
        where: { deletedAt: null },
        include: { _batches: { where: { quantityOnHand: { gt: 0 } } } } as any,
      })
      const lowStockProducts = products.filter((p: any) => {
        const totalQty = p._batches.reduce((sum: number, b: any) => sum + b.quantityOnHand, 0)
        return totalQty <= p.reorderLevel
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
        include: { _product: true } as any,
        orderBy: { expiryDate: 'asc' },
      })
      return NextResponse.json({ success: true, data: batches })
    }

    const batches = await prisma.inventoryBatch.findMany({
      where: productId ? { itemId: productId } : {},
      include: { _product: true } as any,
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
