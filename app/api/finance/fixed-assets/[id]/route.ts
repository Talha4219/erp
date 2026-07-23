import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth<{ params: Promise<{ id: string }> }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const asset = await prisma.fixedAsset.findUnique({
    where: { id: (await params).id },
    include: {
      account: { select: { id: true, code: true, name: true } },
      depreciations: { orderBy: { period: 'asc' } },
    },
  })
  if (!asset) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: asset })
})

export const PUT = withAuth<{ params: Promise<{ id: string }> }>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const asset = await prisma.fixedAsset.update({ where: { id: (await params).id }, data: body })
    return NextResponse.json({ success: true, data: asset })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})

export const DELETE = withAuth<{ params: Promise<{ id: string }> }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    await prisma.fixedAsset.delete({ where: { id: (await params).id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})
