import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'
import { withCache, apiCache } from '@/lib/api-cache'

export const GET = withAuth(async () => {
  try {
    return await withCache('discounts', 1800, () =>
      prisma.discountRule.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 })
    )
  } catch {
    return NextResponse.json(apiError('Failed to fetch discounts'), { status: 500 })
  }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { code, name, type, value, minOrderValue, maxUsage, startDate, endDate, description } = body
    if (!code || !name || value === undefined) return NextResponse.json(apiError('code, name, value required'), { status: 400 })
    const rule = await prisma.discountRule.create({
      data: { code, name, type: type ?? 'PERCENTAGE', value: Number(value), minOrderValue: minOrderValue ? Number(minOrderValue) : null, maxUsage: maxUsage ? Number(maxUsage) : null, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, description },
    })
    apiCache.invalidate('discounts')
    return NextResponse.json(apiResponse(rule), { status: 201 })
  } catch {
    return NextResponse.json(apiError('Failed to create discount'), { status: 500 })
  }
})
