import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const DELETE = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const id = parseInt(params.id)
  const type = await prisma.employeeType.findUnique({ where: { id } })
  if (!type) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  if (type.isBuiltIn) return NextResponse.json({ success: false, error: 'Cannot delete built-in type' }, { status: 400 })

  try {
    await prisma.employeeType.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
