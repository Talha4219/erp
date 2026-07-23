import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const payments = await prisma.customerPayment.findMany({
      include: { invoice: { include: { customer: { select: { name: true } } } } },
      orderBy: { paymentDate: 'desc' },
      take: 200,
    })
    return NextResponse.json(apiResponse(payments))
  } catch {
    return NextResponse.json(apiError('Failed to fetch payments'), { status: 500 })
  }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { invoiceId, amount, paymentDate, method, reference, notes } = body
    if (!invoiceId || !amount || !method) return NextResponse.json(apiError('invoiceId, amount, method required'), { status: 400 })
    if (Number(amount) <= 0) return NextResponse.json(apiError('Amount must be positive'), { status: 400 })

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.customerPayment.create({ data: { invoiceId, amount: Number(amount), paymentDate: paymentDate ? new Date(paymentDate) : new Date(), method, reference, notes } })
      const invoice = await tx.customerInvoice.findUnique({ where: { id: invoiceId } })
      if (invoice) {
        const newPaid = Number(invoice.paidAmount) + Number(amount)
        const total = Number(invoice.totalAmount)
        const status = newPaid >= total ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : invoice.status
        await tx.customerInvoice.update({ where: { id: invoiceId }, data: { paidAmount: newPaid, status } })
      }
      return p
    })
    return NextResponse.json(apiResponse(payment), { status: 201 })
  } catch {
    return NextResponse.json(apiError('Failed to record payment'), { status: 500 })
  }
})
