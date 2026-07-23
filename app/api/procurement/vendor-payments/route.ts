import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { eventBus } from '@/lib/events/bus'
import { withAuth } from '@/lib/api-middleware'

export async function GET() {
  try {
    const payments = await prisma.vendorPayment.findMany({
      include: { vendorInvoice: { include: { vendor: { select: { name: true } } } } },
      orderBy: { paymentDate: 'desc' },
      take: 200,
    })
    return NextResponse.json(apiResponse(payments))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
}

export const POST = withAuth(async (req: NextRequest, { session }) => {
  try {
    const body = await req.json()
    const { vendorInvoiceId, amount, paymentDate, paymentMethod, reference, notes } = body
    if (!vendorInvoiceId || !amount || !paymentMethod) return NextResponse.json(apiError('vendorInvoiceId, amount, paymentMethod required'), { status: 400 })
    if (Number(amount) <= 0) return NextResponse.json(apiError('Amount must be positive'), { status: 400 })
    let vendorId = ''
    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.vendorPayment.create({ data: { vendorInvoiceId, amount: Number(amount), paymentDate: paymentDate ? new Date(paymentDate) : new Date(), paymentMethod, reference, notes } })
      const inv = await tx.vendorInvoice.findUnique({ where: { id: vendorInvoiceId } })
      if (inv) {
        vendorId = inv.vendorId
        const newPaid = Number(inv.paidAmount) + Number(amount)
        const status = newPaid >= Number(inv.totalAmount) ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : inv.status
        await tx.vendorInvoice.update({ where: { id: vendorInvoiceId }, data: { paidAmount: newPaid, status } })
      }
      return p
    })

    // Fire event — triggers AP journal entry (Dr AP / Cr Cash)
    if (vendorId) {
      eventBus.emit('vendor_payment.completed', {
        paymentId: payment.id,
        vendorId,
        amount: Number(amount),
        userId: session.user.id!,
      }).catch(() => {})
    }

    return NextResponse.json(apiResponse(payment), { status: 201 })
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
