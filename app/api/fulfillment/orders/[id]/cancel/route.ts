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
    if (['DELIVERED', 'CANCELLED', 'COLLECTED'].includes(order.status)) return NextResponse.json({ success: false, error: `Cannot cancel order in ${order.status} status` }, { status: 400 })

    const oldStatus = order.status
    const updated = await prisma.fulfillmentOrder.update({
      where: { id: params.id },
      data: { status: 'CANCELLED' },
    })

    eventBus.emit('fulfillment.status_changed', {
      fulfillmentId: updated.id,
      fulfillmentNumber: updated.fulfillmentNumber,
      fromStatus: oldStatus,
      toStatus: 'CANCELLED',
      userId: session.user.id!,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const POST = withRateLimit(withAudit(withAuth(handler) as Parameters<typeof withAudit>[0], 'FulfillmentOrder'))
