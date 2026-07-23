import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const reviewType = searchParams.get('reviewType')

  const reviews = await prisma.performanceReview.findMany({
    where: {
      ...(employeeId && { employeeId }),
      ...(reviewType && { reviewType: reviewType as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'PROBATION' | 'PIP' }),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { reviewDate: 'desc' },
    take: 200,
  })
  return NextResponse.json({ success: true, data: reviews })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const review = await prisma.performanceReview.create({
      data: {
        employeeId: body.employeeId,
        reviewerId: body.reviewerId,
        reviewDate: new Date(body.reviewDate),
        reviewType: body.reviewType,
        summary: body.summary,
        strengths: body.strengths,
        improvements: body.improvements,
        actionItems: body.actionItems,
        nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : null,
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        reviewer: { select: { firstName: true, lastName: true } },
      },
    })
    return NextResponse.json({ success: true, data: review }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
