import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateFulfillmentOrderSchema } from '@/lib/validations/fulfillment'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const order = await prisma.fulfillmentOrder.findUnique({
      where: { id: params.id },
      select: {
        id: true, fulfillmentNumber: true, soId: true, customerId: true,
        warehouseId: true, method: true, status: true, priority: true,
        deliveryAddress: true, pickupLocation: true, requestedDate: true,
        notes: true, assignedDriverId: true, assignedVehicleId: true,
        companyId: true, createdAt: true, updatedAt: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
        salesOrder: { select: { id: true, soNumber: true, status: true } },
        lineItems: {
          select: { id: true, itemId: true, description: true, quantity: true, item: { select: { id: true, name: true, sku: true } } },
        },
        shipments: {
          select: { id: true, status: true, dispatchedAt: true, deliveredAt: true, driver: { select: { id: true, name: true } }, vehicle: { select: { id: true, vehicleNumber: true } } },
        },
        driver: { select: { id: true, name: true, contactNumber: true, email: true, licenseNumber: true, status: true } },
        vehicle: { select: { id: true, vehicleNumber: true, type: true, status: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    })
    if (!order) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: order })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function patchHandler(req: NextRequest, { params, session }: Params & { session: import('@/lib/api-middleware').AuthedSession }) {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const parsed = updateFulfillmentOrderSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

    const existing = await prisma.fulfillmentOrder.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (parsed.data.warehouseId !== undefined) data.warehouseId = parsed.data.warehouseId
    if (parsed.data.deliveryAddress !== undefined) data.deliveryAddress = parsed.data.deliveryAddress
    if (parsed.data.pickupLocation !== undefined) data.pickupLocation = parsed.data.pickupLocation
    if (parsed.data.priority !== undefined) data.priority = parsed.data.priority
    if (parsed.data.requestedDate !== undefined) data.requestedDate = new Date(parsed.data.requestedDate)
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes
    if (parsed.data.assignedDriverId !== undefined) data.assignedDriverId = parsed.data.assignedDriverId
    if (parsed.data.assignedVehicleId !== undefined) data.assignedVehicleId = parsed.data.assignedVehicleId

    const order = await prisma.fulfillmentOrder.update({
      where: { id: params.id },
      data,
      select: {
        id: true, fulfillmentNumber: true, soId: true, customerId: true, method: true, status: true,
        priority: true, notes: true, assignedDriverId: true, assignedVehicleId: true, createdAt: true,
      },
    })
    return NextResponse.json({ success: true, data: order })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const PATCH = withRateLimit(withAudit(withAuth(patchHandler) as Parameters<typeof withAudit>[0], 'FulfillmentOrder'))

async function deleteHandler(_req: NextRequest, { params, session }: Params & { session: import('@/lib/api-middleware').AuthedSession }) {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const existing = await prisma.fulfillmentOrder.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    await prisma.fulfillmentOrder.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const DELETE = withRateLimit(withAudit(withAuth(deleteHandler) as Parameters<typeof withAudit>[0], 'FulfillmentOrder'))
