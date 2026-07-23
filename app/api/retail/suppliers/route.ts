import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supplierSchema } from '@/lib/validations/retail'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''

  try {
    const suppliers = await prisma.supplier.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(search ? { companyName: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { catalogue: true, _count: { select: { retailPurchaseOrders: true } } },
      orderBy: { companyName: 'asc' },
    })
    return NextResponse.json({ success: true, data: suppliers })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = supplierSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const supplier = await prisma.supplier.create({ data: parsed.data })
    return NextResponse.json({ success: true, data: supplier }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
