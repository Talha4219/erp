import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const year = searchParams.get('year')
  const quarter = searchParams.get('quarter')

  const kpis = await prisma.employeeKpi.findMany({
    where: {
      ...(employeeId && { employeeId }),
      ...(year && { year: parseInt(year) }),
      ...(quarter && { quarter: parseInt(quarter) }),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      kpi: { select: { id: true, name: true, category: true, targetType: true, unit: true } },
    },
    orderBy: [{ year: 'desc' }, { quarter: 'asc' }],
  })
  return NextResponse.json({ success: true, data: kpis })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const kpi = await prisma.employeeKpi.create({
      data: {
        employeeId: body.employeeId,
        kpiId: body.kpiId,
        year: body.year ?? new Date().getFullYear(),
        quarter: body.quarter ?? null,
        target: body.target,
        actual: body.actual ?? null,
        score: body.score ?? null,
        notes: body.notes,
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        kpi: { select: { name: true, targetType: true, unit: true } },
      },
    })
    return NextResponse.json({ success: true, data: kpi }, { status: 201 })
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ success: false, error: 'KPI already assigned for this period' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
})
