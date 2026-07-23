/**
 * GET  /api/security/policy — read active security policy
 * POST /api/security/policy — upsert security policy (SUPER_ADMIN only)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'

const schema = z.object({
  maxLoginAttempts: z.number().int().min(3).max(20).optional(),
  lockoutDurationMins: z.number().int().min(5).max(1440).optional(),
  sessionTimeoutMins: z.number().int().min(15).max(10080).optional(),
  passwordMinLength: z.number().int().min(6).max(64).optional(),
  passwordRequireUpper: z.boolean().optional(),
  passwordRequireNumber: z.boolean().optional(),
  passwordRequireSpecial: z.boolean().optional(),
  mfaRequired: z.boolean().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  let policy = await prisma.securityPolicy.findFirst()
  if (!policy) {
    policy = await prisma.securityPolicy.create({ data: {} })
  }
  return NextResponse.json({ success: true, data: policy })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden — SUPER_ADMIN only' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const existing = await prisma.securityPolicy.findFirst()
    const policy = existing
      ? await prisma.securityPolicy.update({ where: { id: existing.id }, data: parsed.data })
      : await prisma.securityPolicy.create({ data: parsed.data })

    return NextResponse.json({ success: true, data: policy })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
