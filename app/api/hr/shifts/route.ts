import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const employeeId = searchParams.get('employee')

  const shifts = await prisma.shiftRoster.findMany({
    where: {
      ...(from && to && { shiftDate: { gte: new Date(from), lte: new Date(to) } }),
      ...(employeeId && { employeeId }),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
    orderBy: [{ shiftDate: 'asc' }, { startTime: 'asc' }],
  })
  return NextResponse.json({ success: true, data: shifts })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const shift = await prisma.shiftRoster.create({
      data: {
        employeeId: body.employeeId,
        shiftDate: new Date(body.shiftDate),
        startTime: body.startTime,
        endTime: body.endTime,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    })
    return NextResponse.json({ success: true, data: shift }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
