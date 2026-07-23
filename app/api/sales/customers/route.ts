import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { customerSchema } from '@/lib/validations/sales'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''

  try {
    const customers = await prisma.customer.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true, name: true, email: true, phone: true, city: true, country: true,
        contactPerson: true, isActive: true, createdAt: true,
        _count: { select: { invoices: true, salesOrders: true } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ success: true, data: customers })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = customerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const customer = await prisma.customer.create({
      data: parsed.data,
      select: { id: true, name: true, email: true, phone: true, city: true, country: true, contactPerson: true, isActive: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: customer }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
