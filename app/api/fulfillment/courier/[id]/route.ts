import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const shipment = await prisma.courierShipment.findUnique({
      where: { id: params.id },
      include: { fulfillment: { include: { customer: true, lineItems: true } } },
    })
    if (!shipment) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: shipment })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function patchHandler(req: NextRequest, { params, session }: Params & { session: import('@/lib/api-middleware').AuthedSession }) {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const allowedFields = ['courierName', 'trackingNumber', 'shipmentDate', 'estimatedDelivery', 'weight', 'charges', 'status', 'notes']
    const data: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        if (key === 'shipmentDate' || key === 'estimatedDelivery') {
          data[key] = new Date(body[key])
        } else {
          data[key] = body[key]
        }
      }
    }

    const existing = await prisma.courierShipment.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const shipment = await prisma.courierShipment.update({ where: { id: params.id }, data })
    return NextResponse.json({ success: true, data: shipment })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const PATCH = withRateLimit(withAudit(withAuth(patchHandler) as Parameters<typeof withAudit>[0], 'CourierShipment'))
