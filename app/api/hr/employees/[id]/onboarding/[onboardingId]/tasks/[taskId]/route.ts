import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const PATCH = withAuth(async (req: NextRequest, { params, session }: { params: { id: string; onboardingId: string; taskId: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const task = await prisma.employeeOnboardingTask.update({
      where: { id: params.taskId, onboardingId: params.onboardingId },
      data: {
        completedAt: body.completed ? new Date() : null,
        completedById: body.completed ? session.user?.id : null,
        notes: body.notes,
      },
    })

    // auto-complete onboarding if all tasks done
    const allTasks = await prisma.employeeOnboardingTask.findMany({ where: { onboardingId: params.onboardingId } })
    if (allTasks.every((t) => t.completedAt)) {
      await prisma.employeeOnboarding.update({
        where: { id: params.onboardingId },
        data: { completedAt: new Date() },
      })
    }

    return NextResponse.json({ success: true, data: task })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
