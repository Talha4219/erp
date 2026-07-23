import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { courierShipmentSchema } from '@/lib/validations/fulfillment'
import { nextDocNumber } from '@/lib/services/numbering'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { withAuth } from '@/lib/api-middleware'
import { getUserCompanyId, companyScope } from '@/lib/company-scope'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id!)
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const skip = (page - 1) * limit
  const where: import('@prisma/client').Prisma.FulfillmentOrderWhereInput = {
    deletedAt: null,
    ...companyScope(companyId),
    method: 'COURIER',
  }
  try {
    const [courierShipments, total] = await Promise.all([
      prisma.fulfillmentOrder.findMany({
        where,
        select: {
          id: true, fulfillmentNumber: true, soId: true, customerId: true,
          method: true, status: true, priority: true, notes: true, createdAt: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          lineItems: { select: { id: true, itemId: true, description: true, quantity: true } },
          shipments: { select: { id: true, status: true } },
          courierShipments: { select: { id: true, courierName: true, trackingNumber: true, status: true, shipmentDate: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.fulfillmentOrder.count({ where }),
    ])
    return NextResponse.json({ success: true, data: courierShipments, meta: { total, page, limit } })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function postHandler(req: NextRequest) {
  const body = await req.json()
  const parsed = courierShipmentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { fulfillmentId, courierName, trackingNumber, shipmentDate, estimatedDelivery, weight, charges, notes } = parsed.data

  try {
    const fulfillment = await prisma.fulfillmentOrder.findUnique({ where: { id: fulfillmentId } })
    if (!fulfillment) return NextResponse.json({ success: false, error: 'Fulfillment order not found' }, { status: 404 })

    const trackingNumberValue = trackingNumber || await nextDocNumber('courier_shipment')
    const shipment = await prisma.courierShipment.create({
      data: {
        fulfillmentId,
        courierName,
        trackingNumber: trackingNumberValue,
        shipmentDate: new Date(shipmentDate),
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
        weight,
        charges,
        notes,
      },
    })

    return NextResponse.json({ success: true, data: shipment }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const POST = withRateLimit(withAudit(withAuth(postHandler) as Parameters<typeof withAudit>[0], 'CourierShipment'))
