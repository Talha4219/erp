import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const onboardings = await prisma.employeeOnboarding.findMany({
    where: { employeeId: params.id },
    include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ success: true, data: onboardings })
})

export const POST = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const { templateId, type, startDate, notes } = body

    let tasks: { title: string; description?: string; assignedRole?: string; dueDate?: Date; sortOrder: number }[] = []

    if (templateId) {
      const template = await prisma.onboardingTemplate.findUnique({
        where: { id: templateId },
        include: { tasks: { orderBy: { sortOrder: 'asc' } } },
      })
      if (template) {
        const start = new Date(startDate)
        tasks = template.tasks.map((t) => ({
          title: t.title,
          description: t.description ?? undefined,
          assignedRole: t.assignedRole ?? undefined,
          dueDate: t.dueAfterDays ? new Date(start.getTime() + t.dueAfterDays * 86400000) : undefined,
          sortOrder: t.sortOrder,
        }))
      }
    }

    const onboarding = await prisma.employeeOnboarding.create({
      data: {
        employeeId: params.id,
        type,
        startDate: new Date(startDate),
        notes,
        tasks: { create: tasks },
      },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    })
    return NextResponse.json({ success: true, data: onboarding }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
