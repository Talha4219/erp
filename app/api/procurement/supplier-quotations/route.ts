import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { nextSupplierQuotationNumber } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const sqs = await prisma.supplierQuotation.findMany({
      where: { deletedAt: null },
      include: { vendor: { select: { name: true } }, rfq: { select: { rfqNumber: true } }, purchaseOrder: { select: { poNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(apiResponse(sqs))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { vendorId, rfqId, quotationDate, validUntil, currency, notes, lineItems = [] } = body
    if (!vendorId || !quotationDate || !validUntil) return NextResponse.json(apiError('vendorId, quotationDate, validUntil required'), { status: 400 })
    const sqNumber = await nextSupplierQuotationNumber()
    type LI = { unitPrice: number; quantity: number; taxRate?: number; [k: string]: unknown }
    const totalAmount = (lineItems as LI[]).reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0)
    const sq = await prisma.supplierQuotation.create({
      data: { sqNumber, vendorId, rfqId, quotationDate: new Date(quotationDate), validUntil: new Date(validUntil), currency: currency ?? 'GBP', totalAmount, notes,
        lineItems: lineItems.length ? { createMany: { data: lineItems.map((i: LI) => ({ ...i, totalPrice: Number(i.unitPrice) * Number(i.quantity) * (1 + Number(i.taxRate ?? 0) / 100) })) } } : undefined },
      include: { lineItems: true },
    })
    return NextResponse.json(apiResponse(sq), { status: 201 })
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
