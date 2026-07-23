import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

type Params = { params: { id: string } }

export const POST = withAuth<Params>(async (_req: NextRequest, { params }) => {
  try {
    const order = await prisma.salesOrder.findUnique({
      where: { id: params.id },
      include: { customer: true },
    })
    if (!order) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    if (order.status !== 'RESERVED')
      return NextResponse.json({ success: false, error: 'Order must be RESERVED before credit check' }, { status: 400 })

    const creditLimit = Number(order.customer.creditLimit ?? 0)

    if (creditLimit === 0) {
      // No credit limit set — auto-approve
      await prisma.salesOrder.update({ where: { id: params.id }, data: { status: 'PICKING' } })
      return NextResponse.json({ success: true, data: { approved: true, status: 'PICKING', reason: 'No credit limit set' } })
    }

    // Sum outstanding invoices (SENT + PARTIALLY_PAID)
    const outstanding = await prisma.customerInvoice.aggregate({
      where: {
        customerId: order.customerId,
        status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: { totalAmount: true },
    })
    const outstandingAmount = Number(outstanding._sum.totalAmount ?? 0)
    const orderTotal = Number(order.totalAmount)
    const totalExposure = outstandingAmount + orderTotal

    const approved = totalExposure <= creditLimit

    await prisma.salesOrder.update({
      where: { id: params.id },
      data: { status: approved ? 'PICKING' : 'CREDIT_HOLD' },
    })

    return NextResponse.json({
      success: true,
      data: {
        approved,
        status: approved ? 'PICKING' : 'CREDIT_HOLD',
        creditLimit,
        outstandingAmount,
        orderTotal,
        totalExposure,
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
