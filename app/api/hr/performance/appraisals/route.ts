import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const year = searchParams.get('year')
  const status = searchParams.get('status')

  const appraisals = await prisma.performanceAppraisal.findMany({
    where: {
      ...(employeeId && { employeeId }),
      ...(year && { year: parseInt(year) }),
      ...(status && { status: status as 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'APPROVED' }),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
      criteria: true,
    },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ success: true, data: appraisals })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const appraisal = await prisma.performanceAppraisal.create({
      data: {
        employeeId: body.employeeId,
        reviewerId: body.reviewerId,
        period: body.period,
        year: body.year ?? new Date().getFullYear(),
        status: 'DRAFT',
        selfComments: body.selfComments,
        reviewerComments: body.reviewerComments,
        criteria: body.criteria?.length
          ? { create: body.criteria.map((c: { criteria: string; weight?: number }) => ({
              criteria: c.criteria,
              weight: c.weight ?? 1,
            })) }
          : undefined,
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        criteria: true,
      },
    })
    return NextResponse.json({ success: true, data: appraisal }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
