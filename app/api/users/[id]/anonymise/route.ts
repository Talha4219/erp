import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const actor = session.user as { id: string; role?: string }
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  const { id } = await params

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: 'ANONYMISED',
        email: `anon-${id}@deleted.invalid`,
        phone: null,
        address: null,
        bio: null,
        avatarUrl: null,
        password: 'ANONYMISED',
        isActive: false,
        deletedAt: new Date(),
      },
      select: { id: true, email: true, deletedAt: true },
    })

    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'GDPR_ANONYMISE',
        entity: 'User',
        entityId: id,
        newValues: { isAnonymised: true },
      },
    })

    return NextResponse.json({ success: true, data: user })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
