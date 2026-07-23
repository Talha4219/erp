import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const USER_SELECT = {
  id: true, email: true, name: true, phone: true, role: true, status: true,
  isActive: true, branchId: true, departmentId: true, lastLoginAt: true,
  lockedUntil: true, loginAttempts: true, createdAt: true,
  branch: { select: { id: true, name: true, code: true } },
  userDept: { select: { id: true, name: true, code: true } },
  employee: { select: { id: true, employeeCode: true, designation: { select: { name: true } }, department: { select: { name: true } } } },
  userRoles: {
    include: { customRole: { include: { permissions: { include: { permission: true } } } } },
    where: { OR: [{ validTo: null }, { validTo: { gte: new Date() } }] },
  },
}

// ── List / Get ──────────────────────────────────────────────────────────

export function getUsers() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id, deletedAt: null }, select: USER_SELECT })
}

export function getMe(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, avatarUrl: true, address: true, bio: true, onboardingDone: true, role: true, branch: true, createdAt: true, lastLoginAt: true },
  })
}

// ── Create ──────────────────────────────────────────────────────────────

export async function createUser(data: {
  email: string; name: string; password: string; role?: string; phone?: string; isActive?: boolean
  branchId?: string | null; departmentId?: string | null; customRoleId?: string | null
}) {
  const hashedPwd = await bcrypt.hash(data.password, 12)
  const targetRole = (data.role as any) || 'VIEWER'

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email, name: data.name, password: hashedPwd, role: targetRole,
        phone: data.phone, isActive: data.isActive ?? true,
        branchId: data.branchId ?? undefined, departmentId: data.departmentId ?? undefined,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    })

    if (data.customRoleId) {
      await tx.userRole.create({ data: { userId: user.id, customRoleId: data.customRoleId } })
      const role = await tx.customRole.findUnique({
        where: { id: data.customRoleId },
        include: { permissions: { include: { permission: true } } },
      })
      if (role) {
        const permSet = new Set(role.permissions.map((rp) => `${rp.permission.module}:${rp.permission.action}`))
        const { generateDashboardForPermissions } = await import('@/lib/dashboard-templates')
        const widgets = generateDashboardForPermissions(permSet)
        await tx.dashboardConfig.create({ data: { userId: user.id, widgets } })
      }
    }

    return user
  })
}

// ── Update ──────────────────────────────────────────────────────────────

export async function updateUser(id: string, data: Record<string, unknown>, actorRole?: string) {
  const updatable = ['name', 'email', 'phone', 'isActive', 'status', 'branchId', 'departmentId']
  const updateData: Record<string, unknown> = {}

  if (data.password) {
    updateData.password = await bcrypt.hash(data.password as string, 12)
  }
  if (data.role !== undefined && actorRole) {
    const { canAssignRole } = await import('@/lib/authz')
    if (!canAssignRole(actorRole as any, data.role as any)) throw new Error('Cannot assign this role')
    updateData.role = data.role
  }
  for (const key of updatable) {
    if (data[key] !== undefined) updateData[key] = data[key]
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: updateData, select: USER_SELECT })

    if (data.customRoleId !== undefined) {
      await tx.userRole.deleteMany({ where: { userId: id } })
      if (data.customRoleId) {
        await tx.userRole.create({ data: { userId: id, customRoleId: data.customRoleId as string } })
      }
    }

    return user
  })
}

export async function updateMe(userId: string, data: Record<string, unknown>) {
  const allowed = ['name', 'phone', 'avatarUrl', 'address', 'bio', 'onboardingDone']
  const updateData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = data[key]
  }
  return prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, name: true, email: true, phone: true, avatarUrl: true, address: true, bio: true, onboardingDone: true, role: true, branch: true, createdAt: true, lastLoginAt: true },
  })
}

// ── Suspend / Anonymise ─────────────────────────────────────────────────

export async function suspendUser(id: string, action: string) {
  let data: Record<string, unknown>
  switch (action) {
    case 'suspend':
      data = { status: 'SUSPENDED', isActive: false }
      break
    case 'reactivate':
      data = { status: 'ACTIVE', isActive: true, loginAttempts: 0, lockedUntil: null }
      break
    case 'unlock':
      data = { loginAttempts: 0, lockedUntil: null, status: 'ACTIVE' }
      break
    default:
      throw new Error('Invalid action')
  }
  return prisma.user.update({ where: { id }, data, select: { id: true, email: true, name: true, status: true, isActive: true, lockedUntil: true } })
}

export async function anonymiseUser(id: string, actorId: string) {
  const user = await prisma.user.update({
    where: { id },
    data: { name: 'ANONYMISED', email: `anon-${id}@deleted.invalid`, phone: null, address: null, bio: null, avatarUrl: null, password: 'ANONYMISED', isActive: false, deletedAt: new Date() },
    select: { id: true, email: true, deletedAt: true },
  })
  await prisma.auditLog.create({ data: { userId: actorId, action: 'GDPR_ANONYMISE', entity: 'User', entityId: id, newValues: { isAnonymised: true } } })
  return user
}

// ── Roles ───────────────────────────────────────────────────────────────

export function getUserRoles(userId: string) {
  return prisma.userRole.findMany({
    where: { userId },
    include: { customRole: { include: { permissions: { include: { permission: true } } } } },
    orderBy: { customRole: { name: 'asc' } },
  })
}

export async function assignUserRole(userId: string, data: { customRoleId: string; branchId?: string; departmentId?: string; validFrom?: string; validTo?: string }) {
  const role = await prisma.userRole.create({
    data: {
      userId, customRoleId: data.customRoleId,
      branchId: data.branchId, departmentId: data.departmentId,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validTo: data.validTo ? new Date(data.validTo) : undefined,
    },
    include: { customRole: { include: { permissions: { include: { permission: true } } } } },
  })
  const { invalidatePermCache } = await import('@/lib/middleware/permission')
  await invalidatePermCache(userId)
  return role
}

export async function removeUserRole(userId: string, userRoleId: string) {
  await prisma.userRole.delete({ where: { id: userRoleId, userId } })
  const { invalidatePermCache } = await import('@/lib/middleware/permission')
  await invalidatePermCache(userId)
}

// ── Permissions ─────────────────────────────────────────────────────────

export async function getUserPermissions(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!user) return null

  const userRoles = await prisma.userRole.findMany({
    where: { userId, OR: [{ validTo: null }, { validTo: { gte: new Date() } }] },
    include: { customRole: { select: { id: true, name: true, permissions: { include: { permission: true } } } } },
  })

  const permissionMap = new Map<string, { module: string; action: string; scope: string | null; via: string[] }>()
  for (const ur of userRoles) {
    for (const rp of ur.customRole.permissions) {
      const key = `${rp.permission.module}:${rp.permission.action}`
      if (!permissionMap.has(key)) {
        permissionMap.set(key, { module: rp.permission.module, action: rp.permission.action, scope: rp.scope ?? null, via: [] })
      }
      permissionMap.get(key)!.via.push(ur.customRole.name)
    }
  }

  return { builtInRole: user.role, permissions: Array.from(permissionMap.values()) }
}

// ── Dashboard ───────────────────────────────────────────────────────────

async function generateAndSaveDashboard(userId: string) {
  const userRoles = await prisma.userRole.findMany({
    where: { userId, OR: [{ validTo: null }, { validTo: { gte: new Date() } }] },
    include: { customRole: { include: { permissions: { include: { permission: true } } } } },
  })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })

  const allPerms = new Set<string>()
  for (const ur of userRoles) {
    for (const rp of ur.customRole.permissions) {
      allPerms.add(`${rp.permission.module}:${rp.permission.action}`)
    }
  }

  const { generateDashboardForPermissions, ALL_WIDGETS } = await import('@/lib/dashboard-templates')
  const widgets = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' ? ALL_WIDGETS : generateDashboardForPermissions(allPerms)

  return prisma.dashboardConfig.upsert({
    where: { userId },
    create: { userId, widgets },
    update: { widgets },
  })
}

export function getUserDashboard(userId: string) {
  return prisma.dashboardConfig.findUnique({ where: { userId } })
}

export function updateUserDashboard(userId: string, widgets: any[]) {
  return prisma.dashboardConfig.upsert({
    where: { userId },
    create: { userId, widgets },
    update: { widgets },
  })
}

export function regenerateUserDashboard(userId: string) {
  return generateAndSaveDashboard(userId)
}

export async function getMyDashboard(userId: string) {
  let config = await prisma.dashboardConfig.findUnique({ where: { userId } })

  if (!config) {
    config = await generateAndSaveDashboard(userId)
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })

  if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
    const { ALL_WIDGETS } = await import('@/lib/dashboard-templates')
    return { widgets: ALL_WIDGETS }
  }

  const userRoles = await prisma.userRole.findMany({
    where: { userId, OR: [{ validTo: null }, { validTo: { gte: new Date() } }] },
    include: { customRole: { include: { permissions: { include: { permission: true } } } } },
  })

  const allPerms = new Set<string>()
  for (const ur of userRoles) {
    for (const rp of ur.customRole.permissions) {
      allPerms.add(`${rp.permission.module}:${rp.permission.action}`)
    }
  }

  const { generateDashboardForPermissions } = await import('@/lib/dashboard-templates')
  return { widgets: generateDashboardForPermissions(allPerms) }
}

// ── Groups ──────────────────────────────────────────────────────────────

export function listGroups() {
  return prisma.userGroup.findMany({
    include: { members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } }, _count: { select: { members: true } } },
    orderBy: { name: 'asc' },
  })
}

export async function createGroup(data: { name: string; description?: string; isActive?: boolean; userIds?: string[] }) {
  const { userIds, ...groupData } = data
  return prisma.userGroup.create({
    data: {
      ...groupData,
      members: userIds?.length ? { create: userIds.map((userId) => ({ userId })) } : undefined,
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } }, _count: { select: { members: true } } },
  })
}

export async function updateGroup(id: string, data: Record<string, unknown>) {
  const allowed = ['name', 'description', 'isActive']
  const groupData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) groupData[key] = data[key]
  }
  const addUserIds = data.addUserIds as string[] | undefined
  const removeUserIds = data.removeUserIds as string[] | undefined

  await prisma.$transaction(async (tx) => {
    if (Object.keys(groupData).length) {
      await tx.userGroup.update({ where: { id }, data: groupData as any })
    }
    if (addUserIds?.length) {
      await tx.userGroupMember.createMany({ data: addUserIds.map((userId) => ({ groupId: id, userId })), skipDuplicates: true })
    }
    if (removeUserIds?.length) {
      await tx.userGroupMember.deleteMany({ where: { groupId: id, userId: { in: removeUserIds } } })
    }
  })

  return prisma.userGroup.findUnique({
    where: { id },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } }, _count: { select: { members: true } } },
  })
}

export function deleteGroup(id: string) {
  return prisma.userGroup.delete({ where: { id } })
}
