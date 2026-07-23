import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const pickup = await prisma.fulfillmentOrder.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        salesOrder: true,
        lineItems: true,
        warehouse: true,
      },
    })
    if (!pickup) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: pickup })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
