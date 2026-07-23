/**
 * POST /api/portal/auth/login  — Customer or Supplier portal login
 * DELETE /api/portal/auth/logout — Revoke portal session token
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePortalToken, validatePortalToken } from '@/lib/portal-auth'
import bcrypt from 'bcryptjs'
import { z } from 'zod/v4'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const SESSION_DURATION_HOURS = 8

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'email and password required' }, { status: 400 })
  }

  const { email, password } = parsed.data

  const portalUser = await prisma.portalUser.findUnique({ where: { email } })
  if (!portalUser || !portalUser.isActive || portalUser.deletedAt) {
    return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
  }

  // Account lockout check
  if (portalUser.lockedUntil && portalUser.lockedUntil > new Date()) {
    return NextResponse.json(
      { success: false, error: 'Account temporarily locked. Try again later.' },
      { status: 401 }
    )
  }

  const valid = await bcrypt.compare(password, portalUser.password)
  if (!valid) {
    const newAttempts = portalUser.loginAttempts + 1
    const shouldLock = newAttempts >= 5
    await prisma.portalUser.update({
      where: { id: portalUser.id },
      data: {
        loginAttempts: newAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + 15 * 60_000) : undefined,
      },
    })
    return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
  }

  const token = generatePortalToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 3600_000)

  await prisma.$transaction([
    prisma.portalSession.create({
      data: {
        portalUserId: portalUser.id,
        token,
        expiresAt,
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
      },
    }),
    prisma.portalUser.update({
      where: { id: portalUser.id },
      data: { lastLoginAt: new Date(), loginAttempts: 0, lockedUntil: null },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      token,
      expiresAt,
      user: {
        id: portalUser.id,
        name: portalUser.name,
        email: portalUser.email,
        type: portalUser.type,
        entityId: portalUser.entityId,
      },
    },
  })
}

export async function DELETE(req: NextRequest) {
  const ctx = await validatePortalToken(req)
  if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const auth = req.headers.get('authorization')!.slice(7)
  await prisma.portalSession.updateMany({
    where: { token: auth },
    data: { revokedAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
