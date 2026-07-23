import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revokePortalSessions } from '@/lib/portal-auth'
import bcrypt from 'bcryptjs'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { password, action, ...rest } = body

  try {
    if (action === 'suspend') {
      await revokePortalSessions(id)
      await prisma.portalUser.update({ where: { id }, data: { isActive: false } })
      return NextResponse.json({ success: true })
    }

    if (action === 'reactivate') {
      await prisma.portalUser.update({
        where: { id },
        data: { isActive: true, loginAttempts: 0, lockedUntil: null },
      })
      return NextResponse.json({ success: true })
    }

    const hashedPwd = password ? await bcrypt.hash(password, 12) : undefined
    const user = await prisma.portalUser.update({
      where: { id },
      data: { ...rest, ...(hashedPwd ? { password: hashedPwd } : {}) },
      select: { id: true, email: true, name: true, type: true, isActive: true },
    })
    return NextResponse.json({ success: true, data: user })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  try {
    await revokePortalSessions(id)
    await prisma.portalUser.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
