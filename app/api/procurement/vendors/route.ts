import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest) => {
  const search = new URL(req.url).searchParams.get('search') ?? ''
  const vendors = await prisma.vendor.findMany({
    where: { deletedAt: null, ...(search && { name: { contains: search, mode: 'insensitive' } }) },
    select: {
      id: true, name: true, vendorCode: true, email: true, phone: true,
      contactPerson: true, taxId: true, address: true, city: true, country: true,
      isActive: true, createdAt: true,
    },
    orderBy: { name: 'asc' },
    take: 100,
  })
  return NextResponse.json({ success: true, data: vendors })
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const vendor = await prisma.vendor.create({
      data: body,
      select: { id: true, name: true, vendorCode: true, email: true, phone: true, contactPerson: true, taxId: true, address: true, city: true, country: true, isActive: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: vendor }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
