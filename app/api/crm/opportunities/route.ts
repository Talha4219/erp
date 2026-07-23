import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const opps = await prisma.crmOpportunity.findMany({
      where: { deletedAt: null },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ success: true, data: opps })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const allowed = {
      title: body.title,
      leadId: body.leadId ?? null,
      contactId: body.contactId ?? null,
      customerId: body.customerId ?? null,
      stage: body.stage ?? 'PROSPECTING',
      probability: body.probability ?? 0,
      value: body.value ?? 0,
      expectedClose: body.expectedClose ? new Date(body.expectedClose) : null,
      assignedTo: body.assignedTo ?? null,
      notes: body.notes ?? null,
    }
    const opp = await prisma.crmOpportunity.create({ data: allowed })
    return NextResponse.json({ success: true, data: opp }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
