import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { quotationSchema } from '@/lib/validations/sales'
import { nextQuotationNumber } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const quotations = await prisma.quotation.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { id: true, name: true } }, lineItems: true },
      orderBy: { quotationDate: 'desc' },
      take: 100,
    })
    return NextResponse.json({ success: true, data: quotations })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = quotationSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { customerId, quotationDate, expiryDate, notes, lineItems } = parsed.data

  const processedItems = lineItems.map((li) => {
    const totalPrice = li.quantity * li.unitPrice * (1 - li.discount / 100) * (1 + li.taxRate / 100)
    return { ...li, totalPrice }
  })

  const subTotal = processedItems.reduce((s, li) => s + li.totalPrice, 0)
  const taxAmount = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice * li.taxRate / 100, 0)
  const discountAmount = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice * li.discount / 100, 0)
  const totalAmount = subTotal + taxAmount - discountAmount

  try {
    const quotationNumber = await nextQuotationNumber()

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        customerId,
        quotationDate: new Date(quotationDate),
        expiryDate: new Date(expiryDate),
        notes,
        subTotal,
        taxAmount,
        discountAmount,
        totalAmount,
        lineItems: { create: processedItems },
      },
      include: { customer: { select: { id: true, name: true } }, lineItems: true },
    })
    return NextResponse.json({ success: true, data: quotation }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
