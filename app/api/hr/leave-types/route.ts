import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { withCache, apiCache } from '@/lib/api-cache'

export const GET = withAuth(async (_req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  return withCache('leave-types', 3600, () => prisma.leaveTypeConfig.findMany({ orderBy: { name: 'asc' } }))
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const type = await prisma.leaveTypeConfig.create({
      data: {
        code: body.code.toUpperCase(),
        name: body.name,
        daysPerYear: body.daysPerYear ?? 0,
        isPaid: body.isPaid ?? true,
        carryForward: body.carryForward ?? false,
        maxCarryDays: body.maxCarryDays ?? 0,
        description: body.description,
        isActive: body.isActive ?? true,
      },
    })
    apiCache.invalidate('leave-types')
    return NextResponse.json({ success: true, data: type }, { status: 201 })
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ success: false, error: 'Leave type code already exists' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
})
