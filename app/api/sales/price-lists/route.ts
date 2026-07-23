import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { nextPriceListCode } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'
import { withCache, apiCache } from '@/lib/api-cache'

export const GET = withAuth(async () => {
  try {
    return await withCache('price-lists', 600, () =>
      prisma.priceList.findMany({
        where: { deletedAt: null },
        include: { _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    )
  } catch {
    return NextResponse.json(apiError('Failed to fetch price lists'), { status: 500 })
  }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { name, currency, startDate, endDate, isDefault, description } = body
    if (!name) return NextResponse.json(apiError('name required'), { status: 400 })
    const code = await nextPriceListCode()
    if (isDefault) await prisma.priceList.updateMany({ where: { isDefault: true, deletedAt: null }, data: { isDefault: false } })
    const list = await prisma.priceList.create({
      data: { code, name, currency: currency ?? 'GBP', startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, isDefault: !!isDefault, description },
    })
    apiCache.invalidate('price-lists')
    return NextResponse.json(apiResponse(list), { status: 201 })
  } catch {
    return NextResponse.json(apiError('Failed to create price list'), { status: 500 })
  }
})
