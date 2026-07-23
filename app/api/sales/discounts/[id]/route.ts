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
    if (body.type !== undefined) allowed.type = body.type
    if (body.value !== undefined) allowed.value = Number(body.value)
    if (body.minOrderValue !== undefined) allowed.minOrderValue = body.minOrderValue ? Number(body.minOrderValue) : null
    if (body.maxUsage !== undefined) allowed.maxUsage = body.maxUsage ? Number(body.maxUsage) : null
    if (body.startDate !== undefined) allowed.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.endDate !== undefined) allowed.endDate = body.endDate ? new Date(body.endDate) : null
    if (body.description !== undefined) allowed.description = body.description
    if (body.isActive !== undefined) allowed.isActive = body.isActive
    const updated = await prisma.discountRule.update({ where: { id }, data: allowed })
    return NextResponse.json(apiResponse(updated))
  } catch {
    return NextResponse.json(apiError('Failed to update'), { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    await prisma.discountRule.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json(apiResponse(null))
  } catch {
    return NextResponse.json(apiError('Failed to delete'), { status: 500 })
  }
})
