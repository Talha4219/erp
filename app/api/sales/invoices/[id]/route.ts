import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const invoice = await prisma.customerInvoice.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      lineItems: true,
      payments: { orderBy: { paymentDate: 'desc' } },
    },
  })
  if (!invoice) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: invoice })
})

export const PATCH = withAuth<Params>(async (req: NextRequest, { params, session }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const allowed: Record<string, unknown> = {}
    if (body.status !== undefined) allowed.status = body.status
    if (body.notes !== undefined) allowed.notes = body.notes
    if (body.dueDate !== undefined) allowed.dueDate = new Date(body.dueDate)
    const invoice = await prisma.customerInvoice.update({ where: { id: params.id }, data: allowed })
    return NextResponse.json({ success: true, data: invoice })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
