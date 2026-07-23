import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nextCustomerInvoiceNumber } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const order = await prisma.salesOrder.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      lineItems: true,
      quotation: { select: { id: true, quotationNumber: true } },
      invoices: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
      reservations: { where: { status: 'ACTIVE' }, select: { id: true, itemId: true, warehouseId: true, reservedQty: true } },
      requisitions: { select: { id: true, prNumber: true, status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  if (!order) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: order })
})

export const PATCH = withAuth<Params>(async (req: NextRequest, { params, session }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const body = await req.json()

    if (body.action === 'release-hold') {
      const order = await prisma.salesOrder.findUnique({ where: { id: params.id } })
      if (!order) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      if (order.status !== 'CREDIT_HOLD')
        return NextResponse.json({ success: false, error: 'Order is not on credit hold' }, { status: 400 })
      const updated = await prisma.salesOrder.update({ where: { id: params.id }, data: { status: 'PICKING' } })
      return NextResponse.json({ success: true, data: updated })
    }

    if (body.action === 'convert-to-invoice') {
      const order = await prisma.salesOrder.findUnique({
        where: { id: params.id },
        include: { lineItems: true },
      })
      if (!order) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

      const invoiceNumber = await nextCustomerInvoiceNumber()
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)

      const invoice = await prisma.customerInvoice.create({
        data: {
          invoiceNumber,
          customerId: order.customerId,
          soId: order.id,
          invoiceDate: new Date(),
          dueDate,
          subTotal: order.subTotal,
          taxAmount: order.taxAmount,
          discountAmount: order.discountAmount,
          totalAmount: order.totalAmount,
          notes: order.notes ?? undefined,
          lineItems: {
            create: order.lineItems.map((li) => ({
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
      })
      return NextResponse.json({ success: true, data: invoice }, { status: 201 })
    }

    // Whitelist mutable fields — never spread raw body into Prisma
    const allowed = { status: body.status, deliveryDate: body.deliveryDate, notes: body.notes }
    const order = await prisma.salesOrder.update({ where: { id: params.id }, data: allowed })
    return NextResponse.json({ success: true, data: order })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    await prisma.salesOrder.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
