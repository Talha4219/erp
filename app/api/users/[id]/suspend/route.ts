/**
 * PATCH /api/users/[id]/suspend
 * Body: { action: 'suspend' | 'reactivate' | 'unlock' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  if (id === session.user.id) {
    return NextResponse.json({ success: false, error: 'Cannot modify your own account status' }, { status: 400 })
  }

  const { action } = await req.json()
  if (!['suspend', 'reactivate', 'unlock'].includes(action)) {
    return NextResponse.json({ success: false, error: 'action must be suspend | reactivate | unlock' }, { status: 400 })
  }

  try {
    let data: Record<string, unknown>

    if (action === 'suspend') {
      data = { status: 'SUSPENDED', isActive: false }
    } else if (action === 'reactivate') {
      data = { status: 'ACTIVE', isActive: true, loginAttempts: 0, lockedUntil: null }
    } else {
      // unlock — clears lockout but keeps suspension state if suspended
      data = { loginAttempts: 0, lockedUntil: null, status: 'ACTIVE' }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, status: true, isActive: true, lockedUntil: true },
    })
    return NextResponse.json({ success: true, data: user })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
