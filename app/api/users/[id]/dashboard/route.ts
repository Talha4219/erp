import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateDashboardForPermissions } from '@/lib/dashboard-templates'

type Params = Promise<{ id: string }>

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  let config = await prisma.dashboardConfig.findUnique({ where: { userId: id } })
  if (!config) {
    // Auto-generate from current role permissions
    config = await generateAndSaveDashboard(id)
  }

  return NextResponse.json({ success: true, data: config })
}

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { widgets } = await req.json()
  if (!Array.isArray(widgets)) {
    return NextResponse.json({ success: false, error: 'widgets must be an array' }, { status: 400 })
  }

  const config = await prisma.dashboardConfig.upsert({
    where: { userId: id },
    create: { userId: id, widgets },
    update: { widgets },
  })

  return NextResponse.json({ success: true, data: config })
}

export async function POST(_req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const config = await generateAndSaveDashboard(id)
  return NextResponse.json({ success: true, data: config })
}

async function generateAndSaveDashboard(userId: string) {
  const userRoles = await prisma.userRole.findMany({
    where: { userId, OR: [{ validTo: null }, { validTo: { gte: new Date() } }] },
    include: { customRole: { include: { permissions: { include: { permission: true } } } } },
  })

  const permSet = new Set<string>()
  for (const ur of userRoles) {
    for (const rp of ur.customRole.permissions) {
      permSet.add(`${rp.permission.module}:${rp.permission.action}`)
    }
  }

  const widgets = generateDashboardForPermissions(permSet)

  return prisma.dashboardConfig.upsert({
    where: { userId },
    create: { userId, widgets },
    update: { widgets },
  })
}
