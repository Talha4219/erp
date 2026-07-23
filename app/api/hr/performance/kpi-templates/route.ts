import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (_req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const templates = await prisma.kpiTemplate.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ success: true, data: templates })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const template = await prisma.kpiTemplate.create({
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        targetType: body.targetType ?? 'NUMERIC',
        unit: body.unit,
        isActive: body.isActive ?? true,
      },
    })
    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ success: false, error: 'KPI name already exists' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
})
