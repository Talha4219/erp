/**
 * Supplier Portal — GET /api/portal/supplier/rfqs
 * Returns RFQs addressed to the authenticated vendor.
 */
import { NextRequest, NextResponse } from 'next/server'
import { validatePortalToken } from '@/lib/portal-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const ctx = await validatePortalToken(req)
  if (!ctx || ctx.type !== 'SUPPLIER') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rfqs = await prisma.rfq.findMany({
      where: { vendorId: ctx.entityId },
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: rfqs })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
