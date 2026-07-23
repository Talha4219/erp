import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { supplierSchema } from '@/lib/validations/retail'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth<{ params: { id: string } }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'procurement') && !hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { catalogue: true, retailPurchaseOrders: { orderBy: { orderDate: 'desc' }, take: 10 } },
    })
    if (!supplier) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: supplier })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const PUT = withAuth<{ params: { id: string } }>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'procurement') && !hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  const body = await req.json()
  const parsed = supplierSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  try {
    const supplier = await prisma.supplier.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ success: true, data: supplier })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth<{ params: { id: string } }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'procurement') && !hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  try {
    await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
