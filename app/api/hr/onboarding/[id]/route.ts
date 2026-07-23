import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'

export const GET = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const template = await prisma.onboardingTemplate.findUnique({
    where: { id: params.id },
    include: { tasks: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!template) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: template })
})

export const PUT = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { tasks, ...rest } = await req.json()
    const template = await prisma.$transaction(async (tx) => {
      await tx.onboardingTemplateTask.deleteMany({ where: { templateId: params.id } })
      return tx.onboardingTemplate.update({
        where: { id: params.id },
        data: { ...rest, tasks: { create: tasks ?? [] } },
        include: { tasks: { orderBy: { sortOrder: 'asc' } } },
      })
    })
    return NextResponse.json({ success: true, data: template })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    await prisma.onboardingTemplate.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
