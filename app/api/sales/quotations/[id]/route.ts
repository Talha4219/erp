import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nextSalesOrderNumber } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      lineItems: true,
      salesOrder: { select: { id: true, soNumber: true } },
    },
  })
  if (!quotation) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: quotation })
})

export const PATCH = withAuth<Params>(async (req: NextRequest, { params, session }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const body = await req.json()

    if (body.action === 'convert-to-order') {
      const quotation = await prisma.quotation.findUnique({
        where: { id: params.id },
        include: { lineItems: true },
      })
      if (!quotation) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      const existing = await prisma.salesOrder.findUnique({ where: { quotationId: params.id } })
      if (existing) return NextResponse.json({ success: false, error: 'Already converted to order' }, { status: 409 })

      const soNumber = await nextSalesOrderNumber()

      const [order] = await prisma.$transaction([
        prisma.salesOrder.create({
          data: {
            soNumber,
            customerId: quotation.customerId,
            quotationId: quotation.id,
            orderDate: new Date(),
            subTotal: quotation.subTotal,
            taxAmount: quotation.taxAmount,
            discountAmount: quotation.discountAmount,
            totalAmount: quotation.totalAmount,
            notes: quotation.notes ?? undefined,
            lineItems: {
              create: quotation.lineItems.map((li) => ({
                itemId: li.itemId ?? undefined,
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                discount: li.discount,
                taxRate: li.taxRate,
                totalPrice: li.totalPrice,
              })),
            },
          },
        }),
        prisma.quotation.update({ where: { id: params.id }, data: { status: 'ACCEPTED' } }),
      ])

      return NextResponse.json({ success: true, data: order }, { status: 201 })
    }

    const quotation = await prisma.quotation.update({ where: { id: params.id }, data: body })
    return NextResponse.json({ success: true, data: quotation })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    await prisma.quotation.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
