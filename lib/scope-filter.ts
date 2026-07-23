import { prisma } from './prisma'

export type VisibilityScope = 'own' | 'department' | 'branch' | 'organization'

const SCOPE_PRIORITY: Record<string, number> = {
  organization: 4,
  branch: 3,
  department: 2,
  own: 1,
}

/**
 * Returns the broadest data-visibility scope granted to a user for the given permission.
 * ADMIN/SUPER_ADMIN always get organization scope.
 */
export async function getUserPermissionScope(
  userId: string,
  module: string,
  action: string
): Promise<VisibilityScope> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') return 'organization'

  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    include: {
      customRole: {
        include: {
          permissions: {
            where: { permission: { module, action } },
            include: { permission: true },
          },
        },
      },
    },
  })

  let broadest: VisibilityScope = 'own'
  for (const ur of userRoles) {
    for (const rp of ur.customRole.permissions) {
      const scope = (rp.scope as VisibilityScope) ?? 'organization'
      if ((SCOPE_PRIORITY[scope] ?? 0) > (SCOPE_PRIORITY[broadest] ?? 0)) {
        broadest = scope
      }
    }
  }
  return broadest
}

/**
 * Resolves a visibility scope into a Prisma where-fragment.
 * The returned object is spread into a `where:` clause — fields vary by model.
 * Callers pass the field names appropriate for their model:
 *   e.g., { ownField: 'createdById', deptField: 'departmentId', branchField: 'branchId' }
 */
export async function getScopeFilter(
  userId: string,
  scope: VisibilityScope,
  opts: {
    ownField?: string
    deptField?: string
    branchField?: string
  } = {}
): Promise<Record<string, unknown>> {
  if (scope === 'organization') return {}

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      departmentId: true,
      branchId: true,
      employee: { select: { departmentId: true } },
    },
  })

  if (scope === 'own') {
    return opts.ownField ? { [opts.ownField]: userId } : {}
  }

  if (scope === 'department') {
    const deptId = user?.departmentId ?? user?.employee?.departmentId
    return deptId && opts.deptField ? { [opts.deptField]: deptId } : {}
  }

  if (scope === 'branch') {
    return user?.branchId && opts.branchField ? { [opts.branchField]: user.branchId } : {}
  }

  return {}
}
