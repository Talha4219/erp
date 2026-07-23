import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { canAssignRole } from '@/lib/authz'
import type { Role } from '@/types/next-auth'

type Params = Promise<{ id: string }>

const USER_SELECT = {
  id: true, email: true, name: true, phone: true, role: true, status: true,
  isActive: true, branchId: true, departmentId: true, lastLoginAt: true,
  lockedUntil: true, loginAttempts: true, createdAt: true,
  branch: { select: { id: true, name: true, code: true } },
  userDept: { select: { id: true, name: true, code: true } },
  employee: {
    select: {
      id: true, employeeCode: true,
      designation: { select: { name: true } },
      department: { select: { name: true } },
    },
  },
  userRoles: {
    include: {
      customRole: {
        include: { permissions: { include: { permission: true } } },
      },
    },
    where: { OR: [{ validTo: null }, { validTo: { gte: new Date() } }] },
  },
}

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const isSelf = session.user.id === id
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)
  if (!isSelf && !isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const user = await prisma.user.findUnique({ where: { id, deletedAt: null }, select: USER_SELECT })
    if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: user })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { password, customRoleId, role } = body

  // Whitelist updatable fields — never spread the raw body into user.update.
  // Anything not listed here (loginAttempts, lockedUntil, emailVerified, etc.)
  // cannot be set by a client.
  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string') data.name = body.name
  if (typeof body.email === 'string') data.email = body.email
  if (typeof body.phone === 'string') data.phone = body.phone
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (typeof body.status === 'string') data.status = body.status
  if (typeof body.branchId === 'string' || body.branchId === null) data.branchId = body.branchId
  if (typeof body.departmentId === 'string' || body.departmentId === null) data.departmentId = body.departmentId

  // Role changes are privilege-sensitive: the actor must be allowed to grant the
  // target role, and cannot change their own role (no self-escalation).
  if (role !== undefined) {
    if (id === session.user.id) {
      return NextResponse.json({ success: false, error: 'You cannot change your own role' }, { status: 403 })
    }
    if (!canAssignRole(session.user.role, role as Role)) {
      return NextResponse.json({ success: false, error: 'You are not allowed to assign this role' }, { status: 403 })
    }
    data.role = role
  }

  try {
    const hashedPwd = password ? await bcrypt.hash(password, 12) : undefined

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...data,
          ...(hashedPwd ? { password: hashedPwd } : {}),
        },
        select: USER_SELECT,
      })

      // Replace all active role assignments if customRoleId provided
      if (customRoleId !== undefined) {
        await tx.userRole.deleteMany({ where: { userId: id } })
        if (customRoleId) {
          await tx.userRole.create({ data: { userId: id, customRoleId } })
        }
      }

      return updated
    })

    return NextResponse.json({ success: true, data: user })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
