import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth<{ params: { id: string } }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  try {
    const po = await prisma.retailPurchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, lineItems: { include: { product: true } }, grns: true },
    })
    if (!po) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: po })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const PUT = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: import('@/lib/api-middleware').AuthedSession }) => {
  if (!hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  const body = await req.json()
  const allowedFields = ['status', 'expectedDeliveryDate'] as const
  const update: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field]
  }
  if (update.expectedDeliveryDate) update.expectedDeliveryDate = new Date(update.expectedDeliveryDate as string)

  try {
    const oldPo = await prisma.retailPurchaseOrder.findUnique({ where: { id } })
    const po = await prisma.retailPurchaseOrder.update({ where: { id }, data: update })

    await prisma.auditLog.create({
      data: {
        userId: (session.user as { id: string }).id,
        action: 'UPDATE',
        entity: 'RetailPurchaseOrder',
        entityId: String(id),
        oldValues: { status: oldPo?.status },
        newValues: { status: po.status },
      },
    })

    return NextResponse.json({ success: true, data: po })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth<{ params: { id: string } }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  try {
    await prisma.retailPurchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
