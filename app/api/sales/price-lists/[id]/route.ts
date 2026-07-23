import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth, AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

export const GET = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    const list = await prisma.priceList.findUnique({ where: { id }, include: { items: { include: { item: true } } } })
    if (!list) return NextResponse.json(apiError('Not found'), { status: 404 })
    return NextResponse.json(apiResponse(list))
  } catch {
    return NextResponse.json(apiError('Failed to fetch'), { status: 500 })
  }
})

export const PATCH = withAuth(async (req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    const body = await req.json()
    const { items, ...data } = body
    const updated = await prisma.$transaction(async (tx) => {
      if (items !== undefined) {
        await tx.priceListItem.deleteMany({ where: { priceListId: id } })
        if (items.length > 0) {
          await tx.priceListItem.createMany({ data: items.map((i: { description: string; unitPrice: number; minQty?: number; discount?: number; itemId?: string }) => ({ ...i, priceListId: id })) })
        }
      }
      return tx.priceList.update({ where: { id }, data })
    })
    return NextResponse.json(apiResponse(updated))
  } catch {
    return NextResponse.json(apiError('Failed to update'), { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    await prisma.priceList.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json(apiResponse(null))
  } catch {
    return NextResponse.json(apiError('Failed to delete'), { status: 500 })
  }
})
