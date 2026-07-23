import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

export const GET = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    const grn = await prisma.goodsReceiptNote.findUnique({ where: { id }, include: { po: { include: { vendor: true, lineItems: { include: { item: true } } } }, lineItems: true } })
    if (!grn) return NextResponse.json(apiError('Not found'), { status: 404 })
    return NextResponse.json(apiResponse(grn))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
