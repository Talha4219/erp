import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { productSchema } from '@/lib/validations/retail'

export const GET = withAuth<{ params: { id: string } }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'pos') && !hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { _batches: { orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }] } } as any,
    })
    if (!product) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: product })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const PUT = withAuth<{ params: { id: string } }>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'pos') && !hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  const body = await req.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  try {
    const product = await prisma.product.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ success: true, data: product })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth<{ params: { id: string } }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'pos') && !hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  try {
    await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
