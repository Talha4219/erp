import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'

export const PUT = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const entitled = Number(body.entitled)
    const used = Number(body.used ?? 0)
    const pending = Number(body.pending ?? 0)
    const balance = await prisma.leaveBalance.update({
      where: { id: params.id },
      data: { entitled, used, pending, remaining: entitled - used - pending },
    })
    return NextResponse.json({ success: true, data: balance })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
