import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const delivery = await prisma.fulfillmentOrder.findUnique({
      where: { id: params.id },
      select: {
        id: true, fulfillmentNumber: true, soId: true, customerId: true,
        warehouseId: true, method: true, status: true, priority: true,
        deliveryAddress: true, requestedDate: true, notes: true,
        assignedDriverId: true, assignedVehicleId: true, createdAt: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
        salesOrder: { select: { id: true, soNumber: true } },
        lineItems: { select: { id: true, itemId: true, description: true, quantity: true } },
        shipments: {
          select: { id: true, status: true, dispatchedAt: true, deliveredAt: true, driver: { select: { id: true, name: true } }, vehicle: { select: { id: true, vehicleNumber: true } } },
        },
        driver: { select: { id: true, name: true, contactNumber: true, email: true, licenseNumber: true, address: true, status: true } },
        vehicle: { select: { id: true, vehicleNumber: true, type: true, status: true } },
        warehouse: { select: { id: true, name: true } },
      },
    })
    if (!delivery) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: delivery })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
