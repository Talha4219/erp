import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const employeeId = searchParams.get('employee')

  const leaves = await prisma.leave.findMany({
    where: {
      ...(status && { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }),
      ...(employeeId && { employeeId }),
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } },
      },
    },
    orderBy: { startDate: 'desc' },
    take: 100,
  })
  return NextResponse.json({ success: true, data: leaves })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const leave = await prisma.leave.create({
      data: {
        employeeId: body.employeeId,
        leaveType: body.leaveType,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        totalDays: body.totalDays,
        reason: body.reason,
      },
    })
    return NextResponse.json({ success: true, data: leave }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
