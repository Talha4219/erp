import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const policy = await prisma.securityPolicy.findFirst()
    return NextResponse.json({ success: true, data: policy })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { maxLoginAttempts, lockoutDurationMins, sessionTimeoutMins, passwordMinLength, passwordRequireUpper, passwordRequireNumber, passwordRequireSpecial, mfaRequired } = body
  const data = { maxLoginAttempts, lockoutDurationMins, sessionTimeoutMins, passwordMinLength, passwordRequireUpper, passwordRequireNumber, passwordRequireSpecial, mfaRequired }

  try {
    const existing = await prisma.securityPolicy.findFirst()
    const policy = await prisma.securityPolicy.upsert({
      where: { id: existing?.id ?? '' },
      update: data,
      create: data,
    })
    return NextResponse.json({ success: true, data: policy })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
