import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id: params.id },
      include: { customer: true, lineItems: true, fulfillment: true, so: true, warehouse: true },
    })
    if (!returnRequest) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: returnRequest })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function patchHandler(req: NextRequest, { params, session }: Params & { session: import('@/lib/api-middleware').AuthedSession }) {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const existing = await prisma.returnRequest.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const allowed = ['status', 'inspectionNotes', 'resolution', 'notes']
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key]
    }

    if (body.status === 'GOODS_RECEIVED' && !existing.goodsReceivedAt) {
      data.goodsReceivedAt = new Date()
    }
    if (body.status === 'INSPECTED' && !existing.inspectedAt) {
      data.inspectedAt = new Date()
    }
    if (body.status === 'REFUNDED' || body.status === 'REPLACED') {
      data.resolvedAt = new Date()
    }

    const returnRequest = await prisma.returnRequest.update({
      where: { id: params.id },
      data,
      include: { customer: true, lineItems: true },
    })

    return NextResponse.json({ success: true, data: returnRequest })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const PATCH = withRateLimit(withAudit(withAuth(patchHandler) as Parameters<typeof withAudit>[0], 'ReturnRequest'))
