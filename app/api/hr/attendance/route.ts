import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employee')
  const month = searchParams.get('month')
  const year = searchParams.get('year')

  const records = await prisma.attendance.findMany({
    where: {
      ...(employeeId && { employeeId }),
      ...(month && year && {
        date: {
          gte: new Date(`${year}-${String(month).padStart(2,'0')}-01`),
          lte: new Date(`${year}-${String(month).padStart(2,'0')}-31`),
        },
      }),
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
    orderBy: { date: 'desc' },
    take: 200,
  })
  return NextResponse.json({ success: true, data: records })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const record = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: body.employeeId, date: new Date(body.date) } },
      update: { status: body.status, checkIn: body.checkIn ? new Date(body.checkIn) : null, checkOut: body.checkOut ? new Date(body.checkOut) : null, notes: body.notes },
      create: { employeeId: body.employeeId, date: new Date(body.date), status: body.status ?? 'PRESENT', checkIn: body.checkIn ? new Date(body.checkIn) : null, checkOut: body.checkOut ? new Date(body.checkOut) : null },
    })
    return NextResponse.json({ success: true, data: record }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
