import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { projectSchema } from '@/lib/validations/projects'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'projects')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: { tasks: true },
    })
    if (!project) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: project })
  } catch {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'projects')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = projectSchema.partial().safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { startDate, endDate, ...rest } = parsed.data

  try {
    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      },
    })
    return NextResponse.json({ success: true, data: project })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'projects')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  try {
    await prisma.project.update({
      where: { id: params.id },
      data: { status: 'CANCELLED', deletedAt: new Date() },
    })
    return NextResponse.json({ success: true, data: null })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
