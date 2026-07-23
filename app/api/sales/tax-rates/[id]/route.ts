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
    const allowed: Record<string, unknown> = {}
    if (body.code !== undefined) allowed.code = body.code
    if (body.name !== undefined) allowed.name = body.name
    if (body.rate !== undefined) allowed.rate = Number(body.rate)
    if (body.taxType !== undefined) allowed.taxType = body.taxType
    if (body.description !== undefined) allowed.description = body.description
    if (body.isDefault !== undefined) { allowed.isDefault = body.isDefault; if (body.isDefault) await prisma.taxRate.updateMany({ where: { isDefault: true }, data: { isDefault: false } }) }
    if (body.isActive !== undefined) allowed.isActive = body.isActive
    if (body.accountId !== undefined) allowed.accountId = body.accountId
    const updated = await prisma.taxRate.update({ where: { id }, data: allowed })
    return NextResponse.json(apiResponse(updated))
  } catch {
    return NextResponse.json(apiError('Failed to update'), { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    await prisma.taxRate.delete({ where: { id } })
    return NextResponse.json(apiResponse(null))
  } catch {
    return NextResponse.json(apiError('Failed to delete'), { status: 500 })
  }
})
