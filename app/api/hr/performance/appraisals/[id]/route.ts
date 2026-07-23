import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const appraisal = await prisma.performanceAppraisal.findUnique({
    where: { id: params.id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
      criteria: true,
    },
  })
  if (!appraisal) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: appraisal })
})

export const PUT = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()

    const statusDates: Record<string, unknown> = {}
    if (body.status === 'SUBMITTED') statusDates.submittedAt = new Date()
    if (body.status === 'REVIEWED') statusDates.reviewedAt = new Date()
    if (body.status === 'APPROVED') statusDates.approvedAt = new Date()

    const appraisal = await prisma.performanceAppraisal.update({
      where: { id: params.id },
      data: {
        reviewerId: body.reviewerId,
        status: body.status,
        overallScore: body.overallScore,
        selfComments: body.selfComments,
        reviewerComments: body.reviewerComments,
        ...statusDates,
        criteria: body.criteria ? {
          deleteMany: {},
          create: body.criteria.map((c: { criteria: string; weight?: number; selfScore?: number; reviewerScore?: number; comments?: string }) => ({
            criteria: c.criteria,
            weight: c.weight ?? 1,
            selfScore: c.selfScore,
            reviewerScore: c.reviewerScore,
            comments: c.comments,
          })),
        } : undefined,
      },
      include: { criteria: true },
    })
    return NextResponse.json({ success: true, data: appraisal })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
