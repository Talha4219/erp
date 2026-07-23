import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'

type Params = { params: { id: string } }

export const PATCH = withAuth(async (req: NextRequest, { params, session }: Params & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { status } = body
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
  }
  try {
    const leave = await prisma.leave.update({
      where: { id: params.id },
      data: { status, approvedAt: status === 'APPROVED' ? new Date() : null },
    })
    return NextResponse.json({ success: true, data: leave })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
