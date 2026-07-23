import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { paymentSchema } from '@/lib/validations/sales'
import { eventBus } from '@/lib/events/bus'
import { withAuth } from '@/lib/api-middleware'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params }) => {
  try {
    const payments = await prisma.customerPayment.findMany({
      where: { invoiceId: params.id },
      orderBy: { paymentDate: 'desc' },
    })
    return NextResponse.json({ success: true, data: payments })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth<Params>(async (req: NextRequest, { params, session }) => {
  const body = await req.json()
  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { amount, paymentDate, method, reference, notes } = parsed.data

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.customerPayment.create({
        data: {
          invoiceId: params.id,
          amount,
          paymentDate: new Date(paymentDate),
          method,
          reference,
          notes,
        },
      })

      const allPayments = await tx.customerPayment.findMany({ where: { invoiceId: params.id } })
      const paidAmount = allPayments.reduce((s, p) => s + Number(p.amount), 0)
      const invoice = await tx.customerInvoice.findUnique({ where: { id: params.id } })
      const status =
        paidAmount >= Number(invoice!.totalAmount)
          ? 'PAID'
          : paidAmount > 0
          ? 'PARTIALLY_PAID'
          : 'SENT'

      await tx.customerInvoice.update({
        where: { id: params.id },
        data: { paidAmount, status },
      })

      return { payment: newPayment, status, customerId: invoice!.customerId }
    })

    if (payment.status === 'PAID') {
      eventBus.emit('invoice.paid', {
        invoiceId: params.id,
        customerId: payment.customerId,
        amount: Number(amount),
        userId: session.user.id!,
      })
    }

    return NextResponse.json({ success: true, data: payment.payment }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
