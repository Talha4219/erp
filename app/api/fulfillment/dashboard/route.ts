import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { getUserCompanyId, companyScope } from '@/lib/company-scope'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id!)
  try {
    const where = { deletedAt: null, ...companyScope(companyId) }

    const today = new Date(new Date().setHours(0, 0, 0, 0))

    const [
      ordersPending,
      approvedOrders,
      inTransit,
      deliveriesToday,
      awaitingPickup,
      returns,
    ] = await Promise.all([
      prisma.fulfillmentOrder.count({ where: { ...where, status: 'DRAFT' } }),
      prisma.fulfillmentOrder.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.fulfillmentOrder.count({ where: { ...where, status: 'DISPATCHED' } }),
      prisma.fulfillmentOrder.count({ where: { ...where, status: 'DELIVERED', updatedAt: { gte: today } } }),
      prisma.fulfillmentOrder.count({ where: { ...where, method: 'CUSTOMER_PICKUP', status: { in: ['APPROVED', 'DISPATCHED'] } } }),
      prisma.returnRequest.count({ where: { ...companyScope(companyId), status: 'PENDING' } }),
    ])

    const recentOrders = await prisma.fulfillmentOrder.findMany({
      where,
      include: { customer: true, lineItems: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      success: true,
      data: {
        ordersPending,
        approvedOrders,
        inTransit,
        deliveriesToday,
        awaitingPickup,
        returns,
        recentOrders,
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
