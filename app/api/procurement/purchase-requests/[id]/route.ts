import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { eventBus } from '@/lib/events/bus'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { auth } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !hasModuleAccess(session, 'procurement'))
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    const pr = await prisma.purchaseRequisition.findUnique({
      where: { id },
      include: {
        vendor: true,
        lineItems: true,
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
        rfqs: { select: { id: true, rfqNumber: true, status: true } },
      },
    })
    if (!pr) return NextResponse.json(apiError('Not found'), { status: 404 })
    return NextResponse.json(apiResponse(pr))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
}

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    const body = await req.json()
    const { status, ...rest } = body

    const current = await prisma.purchaseRequisition.findUnique({
      where: { id },
      select: { status: true, requestedById: true, prNumber: true, department: true, totalAmount: true },
    })
    if (!current) return NextResponse.json(apiError('Not found'), { status: 404 })

    const updated = await prisma.purchaseRequisition.update({
      where: { id },
      data: { ...(status ? { status } : {}), ...rest },
    })

    // Fire cross-module events based on status transition
    if (status && status !== current.status) {
      const approverId = session.user.id!

      if (status === 'PENDING') {
        eventBus.emit('pr.submitted', {
          prId: id,
          prNumber: current.prNumber,
          requestedById: current.requestedById,
          department: current.department,
          totalAmount: Number(current.totalAmount),
        }).catch(() => {})
      }

      if (status === 'APPROVED') {
        eventBus.emit('pr.approved', {
          prId: id,
          prNumber: current.prNumber,
          requestedById: current.requestedById,
          approverId,
        }).catch(() => {})
      }

      if (status === 'REJECTED') {
        eventBus.emit('pr.rejected', {
          prId: id,
          prNumber: current.prNumber,
          requestedById: current.requestedById,
          approverId,
          reason: body.rejectionReason,
        }).catch(() => {})
      }
    }

    return NextResponse.json(apiResponse(updated))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !hasModuleAccess(session, 'procurement'))
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    await prisma.purchaseRequisition.update({ where: { id }, data: { deletedAt: new Date(), status: 'REJECTED' } })
    return NextResponse.json(apiResponse(null))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
}
