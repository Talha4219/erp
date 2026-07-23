/**
 * GET /api/users/[id]/permissions
 * Returns the effective permission set for a user, including scope information.
 * Used for access reviews and the user profile page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = Promise<{ id: string }>

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
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    })
    if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: id,
        OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
      },
      include: {
        customRole: {
          select: {
            id: true,
            name: true,
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    })

    // Flatten to unique module:action:scope triples, taking the broadest scope
    type PermEntry = { module: string; action: string; scope: string | null; via: string[] }
    const permMap = new Map<string, PermEntry>()

    for (const ur of userRoles) {
      for (const rp of ur.customRole.permissions) {
        const key = `${rp.permission.module}:${rp.permission.action}`
        const existing = permMap.get(key)
        if (!existing) {
          permMap.set(key, {
            module: rp.permission.module,
            action: rp.permission.action,
            scope: rp.scope,
            via: [ur.customRole.name],
          })
        } else {
          existing.via.push(ur.customRole.name)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        builtInRole: user.role,
        permissions: Array.from(permMap.values()).sort(
          (a, b) => `${a.module}:${a.action}`.localeCompare(`${b.module}:${b.action}`)
        ),
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
