import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createFulfillmentOrderSchema } from '@/lib/validations/fulfillment'
import { nextDocNumber } from '@/lib/services/numbering'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { getUserCompanyId, companyScope } from '@/lib/company-scope'
import { withAuth } from '@/lib/api-middleware'
import { eventBus } from '@/lib/events/bus'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id!)
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const skip = (page - 1) * limit
  try {
    const [orders, total] = await Promise.all([
      prisma.fulfillmentOrder.findMany({
        where: { deletedAt: null, ...companyScope(companyId) },
        select: {
          id: true, fulfillmentNumber: true, soId: true, customerId: true,
          warehouseId: true, method: true, status: true, priority: true,
          deliveryAddress: true, pickupLocation: true, requestedDate: true,
          notes: true, assignedDriverId: true, assignedVehicleId: true,
          companyId: true, createdAt: true, updatedAt: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          lineItems: { select: { id: true, itemId: true, description: true, quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.fulfillmentOrder.count({ where: { deletedAt: null, ...companyScope(companyId) } }),
    ])
    return NextResponse.json({ success: true, data: orders, meta: { total, page, limit } })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function postHandler(req: NextRequest, { session }: { session: import('@/lib/api-middleware').AuthedSession }) {
  const body = await req.json()
  const parsed = createFulfillmentOrderSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { soId, warehouseId, method, deliveryAddress, pickupLocation, priority, requestedDate, notes, assignedDriverId, assignedVehicleId, lineItems } = parsed.data

  try {
    const fulfillmentNumber = await nextDocNumber('fulfillment_order')
    const companyId = await getUserCompanyId(session.user.id!)

    const so = await prisma.salesOrder.findUnique({ where: { id: soId }, select: { customerId: true } })
    if (!so) return NextResponse.json({ success: false, error: 'Sales order not found' }, { status: 404 })

    const order = await prisma.fulfillmentOrder.create({
      data: {
        fulfillmentNumber,
        soId,
        customerId: so.customerId,
        companyId: companyId ?? undefined,
        warehouseId: warehouseId ?? undefined,
        method,
        deliveryAddress: deliveryAddress ?? undefined,
        pickupLocation: pickupLocation ?? undefined,
        priority,
        requestedDate: requestedDate ? new Date(requestedDate) : undefined,
        notes,
        assignedDriverId: assignedDriverId ?? undefined,
        assignedVehicleId: assignedVehicleId ?? undefined,
        lineItems: { create: lineItems.map((li) => ({ soItemId: li.soItemId, itemId: li.itemId, description: li.description, quantity: li.quantity })) },
      },
      select: {
        id: true, fulfillmentNumber: true, soId: true, customerId: true,
        method: true, status: true, priority: true, notes: true, createdAt: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
        lineItems: { select: { id: true, itemId: true, description: true, quantity: true } },
      },
    })

    eventBus.emit('fulfillment.created', {
      fulfillmentId: order.id,
      fulfillmentNumber: order.fulfillmentNumber,
      soId: order.soId,
      customerId: order.customerId,
      method: order.method,
      userId: session.user.id!,
    })

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const POST = withRateLimit(withAudit(withAuth(postHandler) as Parameters<typeof withAudit>[0], 'FulfillmentOrder'))
