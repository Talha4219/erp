import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
    method: 'COMPANY_DELIVERY',
    status: { not: 'CANCELLED' },
  }
  try {
    const [deliveries, total] = await Promise.all([
      prisma.fulfillmentOrder.findMany({
        where,
        select: {
          id: true, fulfillmentNumber: true, soId: true, customerId: true,
          warehouseId: true, method: true, status: true, priority: true,
          deliveryAddress: true, requestedDate: true, notes: true,
          assignedDriverId: true, assignedVehicleId: true, createdAt: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          lineItems: { select: { id: true, itemId: true, description: true, quantity: true } },
          driver: { select: { id: true, name: true, contactNumber: true, email: true, licenseNumber: true, status: true } },
          vehicle: { select: { id: true, vehicleNumber: true, type: true, status: true } },
          shipments: { select: { id: true, status: true, dispatchedAt: true, deliveredAt: true } },
        },
        orderBy: { requestedDate: 'asc' },
        take: limit,
        skip,
      }),
      prisma.fulfillmentOrder.count({ where }),
    ])
    return NextResponse.json({ success: true, data: deliveries, meta: { total, page, limit } })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
