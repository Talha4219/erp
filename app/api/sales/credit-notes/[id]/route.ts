import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth, AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

export const PATCH = withAuth(async (req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    const body = await req.json()
    const updated = await prisma.creditNote.update({ where: { id }, data: body })
    return NextResponse.json(apiResponse(updated))
  } catch {
    return NextResponse.json(apiError('Failed to update'), { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    await prisma.creditNote.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json(apiResponse(null))
  } catch {
    return NextResponse.json(apiError('Failed to delete'), { status: 500 })
  }
})
