import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  const templates = await prisma.onboardingTemplate.findMany({
    where: { ...(type && { type: type as 'ONBOARDING' | 'OFFBOARDING' }), isActive: true },
    include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ success: true, data: templates })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { tasks = [], ...rest } = await req.json()
    const template = await prisma.onboardingTemplate.create({
      data: {
        ...rest,
        tasks: { create: tasks },
      },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    })
    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
