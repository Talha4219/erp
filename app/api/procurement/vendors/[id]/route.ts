import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, vendorCode: true, email: true, phone: true,
      contactPerson: true, taxId: true, address: true, city: true, country: true,
      isActive: true, createdAt: true, updatedAt: true,
      contacts: {
        where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { firstName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, jobTitle: true, isPrimary: true },
      },
      ratings: { orderBy: { ratedAt: 'desc' }, take: 20 },
      purchaseOrders: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, poNumber: true, status: true, grandTotal: true, orderDate: true, deliveryDate: true },
      },
    },
  })
  if (!vendor) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: vendor })
})

export const PUT = withAuth<Params>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const allowed: Record<string, unknown> = {}
    const fields = ['name', 'vendorCode', 'contactPerson', 'email', 'phone', 'address', 'city', 'country', 'taxId', 'paymentTerms', 'creditLimit', 'isActive'] as const
    for (const f of fields) {
      if (body[f] !== undefined) allowed[f] = body[f]
    }
    if (body.creditLimit !== undefined) allowed.creditLimit = Number(body.creditLimit)
    if (body.paymentTerms !== undefined) allowed.paymentTerms = Number(body.paymentTerms)
    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: allowed,
      select: { id: true, name: true, vendorCode: true, email: true, phone: true, contactPerson: true, taxId: true, address: true, city: true, country: true, isActive: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ success: true, data: vendor })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    await prisma.vendor.update({ where: { id: params.id }, data: { isActive: false, deletedAt: new Date() } })
    return NextResponse.json({ success: true, data: null })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
