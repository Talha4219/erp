import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateDashboardForPermissions } from '@/lib/dashboard-templates'
import { canAssignRole } from '@/lib/authz'
import type { Role } from '@/types/next-auth'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        isActive: true,
        branchId: true,
        departmentId: true,
        lastLoginAt: true,
        lockedUntil: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
        userDept: { select: { id: true, name: true } },
        employee: { select: { id: true, employeeCode: true, designation: { select: { name: true } } } },
        userRoles: {
          include: { customRole: { select: { id: true, name: true } } },
          where: { OR: [{ validTo: null }, { validTo: { gte: new Date() } }] },
        },
        _count: { select: { userGroups: true } },
      },
      orderBy: { name: 'asc' },
      take: 100,
    })
    return NextResponse.json({ success: true, data: users })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { email, name, password, role, customRoleId } = body

  if (!email || !name || !password) {
    return NextResponse.json({ success: false, error: 'email, name and password are required' }, { status: 400 })
  }

  // Prevent privilege escalation: an actor may only create users at a role they
  // are permitted to grant (e.g. ADMIN cannot mint SUPER_ADMIN/ADMIN accounts).
  const targetRole: Role = role ?? 'VIEWER'
  if (!canAssignRole(session.user.role, targetRole)) {
    return NextResponse.json({ success: false, error: 'You are not allowed to assign this role' }, { status: 403 })
  }

  try {
    const hashedPwd = await bcrypt.hash(password, 12)
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name, password: hashedPwd, role: targetRole },
        select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      })
      if (customRoleId) {
        await tx.userRole.create({ data: { userId: created.id, customRoleId } })
        // Auto-generate dashboard based on role permissions
        const roleWithPerms = await tx.customRole.findUnique({
          where: { id: customRoleId },
          include: { permissions: { include: { permission: true } } },
        })
        if (roleWithPerms) {
          const permSet = new Set(roleWithPerms.permissions.map((rp) => `${rp.permission.module}:${rp.permission.action}`))
          const widgets = generateDashboardForPermissions(permSet)
          await tx.dashboardConfig.create({ data: { userId: created.id, widgets } })
        }
      }
      return created
    })
    return NextResponse.json({ success: true, data: user }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
