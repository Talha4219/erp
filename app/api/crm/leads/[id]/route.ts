import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const lead = await prisma.crmLead.findUnique({
    where: { id: params.id },
    select: {
      id: true, firstName: true, lastName: true, company: true,
      email: true, phone: true, source: true, status: true,
      notes: true, createdAt: true,
      campaign: true,
      activities: { orderBy: { createdAt: 'desc' } },
      opportunity: true,
    },
  })
  if (!lead) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: lead })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const allowed: Record<string, unknown> = {}
    const fields = ['firstName', 'lastName', 'email', 'phone', 'company', 'jobTitle', 'source', 'status', 'rating', 'notes', 'campaignId', 'assignedTo'] as const
    for (const f of fields) {
      if (body[f] !== undefined) allowed[f] = body[f]
    }
    const lead = await prisma.crmLead.update({
      where: { id: params.id },
      data: allowed,
      select: { id: true, firstName: true, lastName: true, company: true, email: true, phone: true, source: true, status: true, notes: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: lead })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    await prisma.crmLead.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
