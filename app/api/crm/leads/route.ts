import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const leads = await prisma.crmLead.findMany({
      where: { deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, company: true,
        email: true, phone: true, source: true, status: true,
        notes: true, createdAt: true,
        campaign: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ success: true, data: leads })
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
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email ?? null,
      phone: body.phone ?? null,
      company: body.company ?? null,
      jobTitle: body.jobTitle ?? null,
      source: body.source ?? 'OTHER',
      status: body.status ?? 'NEW',
      rating: body.rating ?? 0,
      notes: body.notes ?? null,
      campaignId: body.campaignId ?? null,
      assignedTo: body.assignedTo ?? null,
    }
    const lead = await prisma.crmLead.create({
      data: allowed,
      select: { id: true, firstName: true, lastName: true, company: true, email: true, phone: true, source: true, status: true, notes: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: lead }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
