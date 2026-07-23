import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, phone: true,
      avatarUrl: true, address: true, bio: true,
      onboardingDone: true, role: true,
      branch: { select: { id: true, name: true } },
      createdAt: true, lastLoginAt: true,
    },
  })
  if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: user })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, phone, avatarUrl, address, bio, onboardingDone } = await req.json()
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(address !== undefined && { address }),
        ...(bio !== undefined && { bio }),
        ...(onboardingDone !== undefined && { onboardingDone }),
      },
      select: {
        id: true, name: true, email: true, phone: true,
        avatarUrl: true, address: true, bio: true, onboardingDone: true,
      },
    })
    return NextResponse.json({ success: true, data: user })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
