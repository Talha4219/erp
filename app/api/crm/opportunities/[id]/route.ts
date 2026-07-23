import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const opp = await prisma.crmOpportunity.findUnique({
    where: { id: params.id },
    include: {
      lead: true, contact: true, customer: true,
      activities: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!opp) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: opp })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const allowed: Record<string, unknown> = {}
    const fields = ['title', 'leadId', 'contactId', 'customerId', 'stage', 'probability', 'value', 'expectedClose', 'assignedTo', 'notes'] as const
    for (const f of fields) {
      if (body[f] !== undefined) allowed[f] = body[f]
    }
    if (body.expectedClose) allowed.expectedClose = new Date(body.expectedClose)
    if (body.value) allowed.value = Number(body.value)
    if (body.probability) allowed.probability = Number(body.probability)
    const opp = await prisma.crmOpportunity.update({ where: { id: params.id }, data: allowed })
    return NextResponse.json({ success: true, data: opp })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    await prisma.crmOpportunity.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
