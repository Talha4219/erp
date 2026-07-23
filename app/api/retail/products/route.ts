import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { productSchema } from '@/lib/validations/retail'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const category = searchParams.get('category') ?? ''

  try {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(search ? { OR: [{ productName: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }] } : {}),
        ...(category ? { category } : {}),
      },
      include: {
        _batches: { where: { quantityOnHand: { gt: 0 } }, orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }] },
      } as any,
      orderBy: { productName: 'asc' },
    })
    return NextResponse.json({ success: true, data: products })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const product = await prisma.product.create({ data: parsed.data })
    return NextResponse.json({ success: true, data: product }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
