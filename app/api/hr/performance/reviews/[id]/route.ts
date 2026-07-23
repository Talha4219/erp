import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const review = await prisma.performanceReview.findUnique({
    where: { id: params.id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
  })
  if (!review) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: review })
})

export const PUT = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const review = await prisma.performanceReview.update({
      where: { id: params.id },
      data: {
        reviewerId: body.reviewerId,
        reviewDate: body.reviewDate ? new Date(body.reviewDate) : undefined,
        reviewType: body.reviewType,
        summary: body.summary,
        strengths: body.strengths,
        improvements: body.improvements,
        actionItems: body.actionItems,
        nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : null,
      },
    })
    return NextResponse.json({ success: true, data: review })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  await prisma.performanceReview.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
})
