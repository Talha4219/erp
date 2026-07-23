import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { generateCode } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const assets = await prisma.fixedAsset.findMany({
    where: { ...(status && { status: status as 'ACTIVE' | 'FULLY_DEPRECIATED' | 'DISPOSED' | 'TRANSFERRED' }) },
    include: {
      account: { select: { id: true, code: true, name: true } },
      depreciations: { orderBy: { period: 'desc' }, take: 1 },
    },
    orderBy: { assetCode: 'asc' },
  })
  return NextResponse.json({ success: true, data: assets })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const count = await prisma.fixedAsset.count()
    const assetCode = body.assetCode || generateCode('FA-', count + 1)
    const asset = await prisma.fixedAsset.create({
      data: {
        ...body,
        assetCode,
        bookValue: body.purchaseCost,
        purchaseDate: new Date(body.purchaseDate),
      },
      include: { account: { select: { id: true, code: true, name: true } } },
    })
    return NextResponse.json({ success: true, data: asset }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})
