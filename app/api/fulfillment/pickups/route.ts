import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { getUserCompanyId, companyScope } from '@/lib/company-scope'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id!)
  try {
    const pickups = await prisma.fulfillmentOrder.findMany({
      where: {
        deletedAt: null,
        ...companyScope(companyId),
        method: 'CUSTOMER_PICKUP',
      },
      select: {
        id: true, fulfillmentNumber: true, soId: true, customerId: true,
        method: true, status: true, priority: true, pickupLocation: true,
        requestedDate: true, notes: true, createdAt: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
        lineItems: { select: { id: true, itemId: true, description: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: pickups })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
