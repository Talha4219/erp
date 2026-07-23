import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { nextPurchaseReturnNumber } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const returns = await prisma.purchaseReturn.findMany({
      where: { deletedAt: null },
      include: { vendor: { select: { name: true } }, grn: { select: { grnNumber: true } }, invoice: { select: { invoiceNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(apiResponse(returns))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { vendorId, grnId, invoiceId, returnDate, reason, notes, lineItems = [] } = body
    if (!vendorId || !returnDate || !reason) return NextResponse.json(apiError('vendorId, returnDate, reason required'), { status: 400 })
    const returnNumber = await nextPurchaseReturnNumber()
    type LI = { unitPrice: number; quantity: number; [k: string]: unknown }
    const totalAmount = (lineItems as LI[]).reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0)
    const ret = await prisma.purchaseReturn.create({
      data: { returnNumber, vendorId, grnId, invoiceId, returnDate: new Date(returnDate), reason, notes, totalAmount,
        lineItems: lineItems.length ? { createMany: { data: lineItems.map((i: LI) => ({ ...i, totalPrice: Number(i.unitPrice) * Number(i.quantity) })) } } : undefined },
      include: { lineItems: true },
    })
    return NextResponse.json(apiResponse(ret), { status: 201 })
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
