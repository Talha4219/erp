/**
 * Customer Portal — GET /api/portal/customer/invoices
 */
import { NextRequest, NextResponse } from 'next/server'
import { validatePortalToken } from '@/lib/portal-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const ctx = await validatePortalToken(req)
  if (!ctx || ctx.type !== 'CUSTOMER') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const invoices = await prisma.customerInvoice.findMany({
      where: { customerId: ctx.entityId, deletedAt: null },
      include: { lineItems: true },
      orderBy: { dueDate: 'asc' },
    })
    return NextResponse.json({ success: true, data: invoices })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
