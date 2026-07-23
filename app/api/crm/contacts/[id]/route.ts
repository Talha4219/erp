import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const contact = await prisma.crmContact.findUnique({
    where: { id: params.id },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      phone: true, mobile: true, jobTitle: true, createdAt: true,
      customer: { select: { id: true, name: true } },
      activities: { orderBy: { createdAt: 'desc' } },
      opportunities: true,
    },
  })
  if (!contact) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: contact })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const allowed: Record<string, unknown> = {}
    const fields = ['firstName', 'lastName', 'email', 'phone', 'mobile', 'jobTitle', 'department', 'customerId', 'notes', 'isActive'] as const
    for (const f of fields) {
      if (body[f] !== undefined) allowed[f] = body[f]
    }
    const contact = await prisma.crmContact.update({
      where: { id: params.id },
      data: allowed,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, jobTitle: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: contact })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    await prisma.crmContact.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
