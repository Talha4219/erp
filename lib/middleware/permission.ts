import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Handler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse>

// Cache permission sets per user for 60 seconds
const permCache = new Map<string, { perms: Set<string>; exp: number }>()

async function getUserPermissions(userId: string): Promise<Set<string>> {
  const cached = permCache.get(userId)
  if (cached && cached.exp > Date.now()) return cached.perms

  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      customRole: {
        include: { permissions: { include: { permission: true } } },
      },
    },
  })

  const perms = new Set<string>()
  for (const ur of userRoles) {
    for (const rp of ur.customRole.permissions) {
      perms.add(`${rp.permission.module}:${rp.permission.action}`)
    }
  }

  permCache.set(userId, { perms, exp: Date.now() + 60_000 })
  return perms
}

export function withPermission(module: string, action: string, handler: Handler): Handler {
  return async (req: NextRequest, ctx: unknown) => {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // SUPER_ADMIN, ADMIN, MANAGER bypass custom permission checks
    const role = (session.user as { role?: string }).role
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER') {
      return handler(req, ctx)
    }

    const userId = session.user.id!
    const perms = await getUserPermissions(userId)
    if (perms.has(`${module}:${action}`)) {
      return handler(req, ctx)
    }

    // Check active delegation: someone delegated their approval rights to this user
    const now = new Date()
    const delegation = await prisma.approvalDelegation.findFirst({
      where: {
        delegateeId: userId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        OR: [{ module: null }, { module }],
      },
    })
    if (delegation) {
      // Delegatee inherits delegator's permissions for this module
      const delegatorPerms = await getUserPermissions(delegation.delegatorId)
      if (delegatorPerms.has(`${module}:${action}`)) {
        return handler(req, ctx)
      }
    }

    return NextResponse.json(
      { success: false, error: `Permission denied: ${module}:${action}` },
      { status: 403 }
    )
  }
}

/** Invalidate permission cache for a user (call after role changes) */
export function invalidatePermCache(userId: string) {
  permCache.delete(userId)
}
