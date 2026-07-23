import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { nextRfqNumber } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const rfqs = await prisma.rfq.findMany({
      where: { deletedAt: null },
      include: { vendor: { select: { name: true } }, pr: { select: { prNumber: true } }, _count: { select: { quotations: true, lineItems: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(apiResponse(rfqs))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { vendorId, prId, rfqDate, dueDate, notes, lineItems = [] } = body
    if (!vendorId || !rfqDate || !dueDate) return NextResponse.json(apiError('vendorId, rfqDate, dueDate required'), { status: 400 })
    const rfqNumber = await nextRfqNumber()
    const rfq = await prisma.rfq.create({
      data: { rfqNumber, vendorId, prId, rfqDate: new Date(rfqDate), dueDate: new Date(dueDate), notes,
        lineItems: lineItems.length ? { createMany: { data: lineItems } } : undefined },
      include: { lineItems: true },
    })
    return NextResponse.json(apiResponse(rfq), { status: 201 })
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
