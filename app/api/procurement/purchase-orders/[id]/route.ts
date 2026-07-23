import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events/bus'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: Promise<{ id: string }> }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      lineItems: { include: { item: true } },
      pr: { select: { id: true, prNumber: true } },
      _count: { select: { grns: true, vendorInvoices: true } },
    },
  })
  if (!po) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: po })
})

export const PATCH = withAuth<Params>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  try {
    const body = await req.json()
    const { status, ...rest } = body

    const current = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { status: true, poNumber: true, vendorId: true, grandTotal: true },
    })
    if (!current) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const po = await prisma.purchaseOrder.update({
      where: { id },
      data: { ...(status ? { status } : {}), ...rest },
    })

    // Fire events on status transitions
    if (status && status !== current.status) {
      const userId = session.user.id!
      if (status === 'APPROVED') {
        eventBus.emit('po.approved', {
          poId: id,
          poNumber: current.poNumber,
          vendorId: current.vendorId,
          grandTotal: Number(current.grandTotal),
          userId,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true, data: po })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  try {
    await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED', deletedAt: new Date() } })
    return NextResponse.json({ success: true, data: null })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
