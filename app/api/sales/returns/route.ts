import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { nextSalesReturnNumber } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const returns = await prisma.salesReturn.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { name: true } }, invoice: { select: { invoiceNumber: true } }, creditNote: { select: { creditNoteNumber: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(apiResponse(returns))
  } catch {
    return NextResponse.json(apiError('Failed to fetch returns'), { status: 500 })
  }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { invoiceId, customerId, returnDate, reason, notes, lineItems } = body
    if (!invoiceId || !customerId || !returnDate || !reason) return NextResponse.json(apiError('invoiceId, customerId, returnDate, reason required'), { status: 400 })
    const returnNumber = await nextSalesReturnNumber()
    const totalAmount = (lineItems ?? []).reduce((s: number, i: { totalPrice: number }) => s + Number(i.totalPrice), 0)
    const ret = await prisma.salesReturn.create({
      data: {
        returnNumber, invoiceId, customerId, returnDate: new Date(returnDate), reason, notes, totalAmount,
        lineItems: lineItems?.length ? { createMany: { data: lineItems.map((li: { description?: string; quantity?: number; unitPrice?: number; itemId?: string; warehouseId?: string }) => ({
        description: li.description ?? '',
        quantity: Number(li.quantity) || 0,
        unitPrice: Number(li.unitPrice) || 0,
        totalPrice: (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0),
        itemId: li.itemId ?? null,
        warehouseId: li.warehouseId ?? null,
      })) } } : undefined,
      },
      include: { lineItems: true },
    })
    return NextResponse.json(apiResponse(ret), { status: 201 })
  } catch {
    return NextResponse.json(apiError('Failed to create return'), { status: 500 })
  }
})
