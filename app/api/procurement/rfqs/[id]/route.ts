import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

export const GET = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    const rfq = await prisma.rfq.findUnique({ where: { id }, include: { vendor: true, pr: true, lineItems: true, quotations: { where: { deletedAt: null }, include: { vendor: { select: { id: true, name: true } } } } } })
    if (!rfq) return NextResponse.json(apiError('Not found'), { status: 404 })
    return NextResponse.json(apiResponse(rfq))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const PATCH = withAuth(async (req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    const body = await req.json()
    const updated = await prisma.rfq.update({ where: { id }, data: body })
    return NextResponse.json(apiResponse(updated))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const DELETE = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    await prisma.rfq.update({ where: { id }, data: { deletedAt: new Date(), status: 'CANCELLED' } })
    return NextResponse.json(apiResponse(null))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
