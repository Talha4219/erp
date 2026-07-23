import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: Request) => {
  try {
    const customerId = new URL(req.url).searchParams.get('customerId')
    const ratings = await prisma.customerRating.findMany({
      where: customerId ? { customerId } : {},
      include: { customer: { select: { name: true, customerCode: true } } },
      orderBy: { ratedAt: 'desc' },
    })
    return NextResponse.json(apiResponse(ratings))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { customerId, ratedByName, overallScore, paymentScore, businessScore, relationshipScore, notes } = body
    if (!customerId || !ratedByName) return NextResponse.json(apiError('customerId and ratedByName required'), { status: 400 })
    const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)))
    const rating = await prisma.customerRating.create({
      data: {
        customerId,
        ratedByName,
        overallScore: clamp(Number(overallScore)),
        paymentScore: clamp(Number(paymentScore)),
        businessScore: clamp(Number(businessScore)),
        relationshipScore: clamp(Number(relationshipScore)),
        notes,
      },
    })
    return NextResponse.json(apiResponse(rating), { status: 201 })
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
