import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'
import { withCache, apiCache } from '@/lib/api-cache'

export const GET = withAuth(async () => {
  try {
    return await withCache('tax-rates', 3600, () =>
      prisma.taxRate.findMany({ orderBy: { rate: 'asc' } })
    )
  } catch {
    return NextResponse.json(apiError('Failed to fetch tax rates'), { status: 500 })
  }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { code, name, rate, description, isDefault } = body
    if (!code || !name || rate === undefined) return NextResponse.json(apiError('code, name, rate required'), { status: 400 })
    if (isDefault) await prisma.taxRate.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
    const taxRate = await prisma.taxRate.create({ data: { code, name, rate: Number(rate), description, isDefault: !!isDefault } })
    apiCache.invalidate('tax-rates')
    return NextResponse.json(apiResponse(taxRate), { status: 201 })
  } catch {
    return NextResponse.json(apiError('Failed to create tax rate'), { status: 500 })
  }
})
