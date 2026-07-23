import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { withAuth } from '@/lib/api-middleware'
import { eventBus } from '@/lib/events/bus'

type Params = { params: { id: string } }

async function handler(req: NextRequest, { params, session }: Params & { session: import('@/lib/api-middleware').AuthedSession }) {
  try {
    const order = await prisma.fulfillmentOrder.findUnique({ where: { id: params.id } })
    if (!order) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const isPickup = order.method === 'CUSTOMER_PICKUP'
    const toStatus = isPickup ? 'COLLECTED' : 'DELIVERED'
    const allowedFrom = isPickup ? ['APPROVED', 'DISPATCHED'] : ['DISPATCHED', 'IN_TRANSIT']

    if (!allowedFrom.includes(order.status)) {
      return NextResponse.json({ success: false, error: `Cannot mark as ${toStatus} from ${order.status} status` }, { status: 400 })
    }

    const oldStatus = order.status
    const updated = await prisma.fulfillmentOrder.update({
      where: { id: params.id },
      data: { status: toStatus },
    })

    await prisma.shipment.updateMany({
      where: { fulfillmentId: params.id, status: 'IN_TRANSIT' },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    })

    if (order.assignedDriverId) {
      await prisma.driver.update({
        where: { id: order.assignedDriverId },
        data: { status: 'AVAILABLE' },
      }).catch(() => {})
    }

    if (order.assignedVehicleId) {
      await prisma.vehicle.update({
        where: { id: order.assignedVehicleId },
        data: { status: 'AVAILABLE' },
      }).catch(() => {})
    }

    eventBus.emit('fulfillment.status_changed', {
      fulfillmentId: updated.id,
      fulfillmentNumber: updated.fulfillmentNumber,
      fromStatus: oldStatus,
      toStatus,
      userId: session.user.id!,
    })

    eventBus.emit('fulfillment.delivered', {
      fulfillmentId: updated.id,
      fulfillmentNumber: updated.fulfillmentNumber,
      soId: updated.soId,
      customerId: updated.customerId,
      userId: session.user.id!,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const POST = withRateLimit(withAudit(withAuth(handler) as Parameters<typeof withAudit>[0], 'FulfillmentOrder'))
