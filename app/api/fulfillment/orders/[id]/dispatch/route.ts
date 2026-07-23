import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { withAuth } from '@/lib/api-middleware'
import { nextDocNumber } from '@/lib/services/numbering'
import { eventBus } from '@/lib/events/bus'

type Params = { params: { id: string } }

async function handler(req: NextRequest, { params, session }: Params & { session: import('@/lib/api-middleware').AuthedSession }) {
  try {
    const order = await prisma.fulfillmentOrder.findUnique({ where: { id: params.id } })
    if (!order) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    if (order.status !== 'APPROVED') return NextResponse.json({ success: false, error: `Cannot dispatch order in ${order.status} status` }, { status: 400 })

    const oldStatus = order.status
    const shipmentNumber = await nextDocNumber('shipment')

    const updated = await prisma.fulfillmentOrder.update({
      where: { id: params.id },
      data: {
        status: 'DISPATCHED',
        shipments: {
          create: { shipmentNumber, status: 'IN_TRANSIT' },
        },
      },
    })

    await prisma.shipment.updateMany({
      where: { fulfillmentId: params.id, status: 'PENDING' },
      data: { status: 'IN_TRANSIT', dispatchedAt: new Date() },
    })

    if (order.assignedDriverId) {
      await prisma.driver.update({
        where: { id: order.assignedDriverId },
        data: { status: 'ON_DELIVERY' },
      }).catch(() => {})
    }

    if (order.assignedVehicleId) {
      await prisma.vehicle.update({
        where: { id: order.assignedVehicleId },
        data: { status: 'ASSIGNED' },
      }).catch(() => {})
    }

    eventBus.emit('fulfillment.status_changed', {
      fulfillmentId: updated.id,
      fulfillmentNumber: updated.fulfillmentNumber,
      fromStatus: oldStatus,
      toStatus: 'DISPATCHED',
      userId: session.user.id!,
    })

    eventBus.emit('fulfillment.dispatched', {
      fulfillmentId: updated.id,
      fulfillmentNumber: updated.fulfillmentNumber,
      soId: updated.soId,
      customerId: updated.customerId,
      userId: session.user.id!,
      driverId: updated.assignedDriverId ?? undefined,
      vehicleId: updated.assignedVehicleId ?? undefined,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const POST = withRateLimit(withAudit(withAuth(handler) as Parameters<typeof withAudit>[0], 'FulfillmentOrder'))
