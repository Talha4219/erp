import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateDashboardForPermissions } from '@/lib/dashboard-templates'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  let config = await prisma.dashboardConfig.findUnique({ where: { userId } })

  if (!config) {
    // Auto-generate from the user's active custom roles
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

    // SUPER_ADMIN / ADMIN get everything
    const role = (session.user as { role?: string }).role
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      const { ALL_WIDGETS } = await import('@/lib/dashboard-templates')
      ALL_WIDGETS.forEach((w) => permSet.add(w.requiredPermission))
    }

    const widgets = generateDashboardForPermissions(permSet)
    config = await prisma.dashboardConfig.create({ data: { userId, widgets } })
  }

  return NextResponse.json({ success: true, data: config })
}
