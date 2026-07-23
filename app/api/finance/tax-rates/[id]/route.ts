import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const PUT = withAuth<{ params: Promise<{ id: string }> }>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const rate = await prisma.taxRate.update({ where: { id: (await params).id }, data: body })
    return NextResponse.json({ success: true, data: rate })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})

export const DELETE = withAuth<{ params: Promise<{ id: string }> }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    await prisma.taxRate.delete({ where: { id: (await params).id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})
