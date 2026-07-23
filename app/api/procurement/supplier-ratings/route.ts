import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: Request) => {
  try {
    const vendorId = new URL(req.url).searchParams.get('vendorId')
    const ratings = await prisma.supplierRating.findMany({
      where: vendorId ? { vendorId } : {},
      include: { vendor: { select: { name: true, vendorCode: true } } },
      orderBy: { ratedAt: 'desc' },
    })
    return NextResponse.json(apiResponse(ratings))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { vendorId, ratedByName, overallScore, qualityScore, deliveryScore, priceScore, notes } = body
    if (!vendorId || !ratedByName) return NextResponse.json(apiError('vendorId and ratedByName required'), { status: 400 })
    const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)))
    const rating = await prisma.supplierRating.create({
      data: {
        vendorId,
        ratedByName,
        overallScore: clamp(Number(overallScore)),
        qualityScore: clamp(Number(qualityScore)),
        deliveryScore: clamp(Number(deliveryScore)),
        priceScore: clamp(Number(priceScore)),
        notes,
      },
    })
    return NextResponse.json(apiResponse(rating), { status: 201 })
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
