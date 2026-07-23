import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: Request, { params }: { params: Promise<{ customerId: string }> }) => {
  try {
    const { customerId } = await params
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const dateFilter = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }

    const [customer, invoices, payments] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, email: true, phone: true, address: true, city: true, country: true } }),
      prisma.customerInvoice.findMany({
        where: { customerId, deletedAt: null, ...(from || to ? { invoiceDate: dateFilter } : {}) },
        select: { id: true, invoiceNumber: true, invoiceDate: true, dueDate: true, totalAmount: true, paidAmount: true, status: true },
        orderBy: { invoiceDate: 'asc' },
      }),
      prisma.customerPayment.findMany({
        where: { invoice: { customerId }, ...(from || to ? { paymentDate: dateFilter } : {}) },
        select: { id: true, amount: true, paymentDate: true, method: true, reference: true, invoice: { select: { invoiceNumber: true } } },
        orderBy: { paymentDate: 'asc' },
      }),
    ])

    if (!customer) return NextResponse.json(apiError('Customer not found'), { status: 404 })

    const totalBilled = invoices.reduce((s, i) => s + Number(i.totalAmount), 0)
    const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0)
    const totalOutstanding = totalBilled - totalPaid
    const overdueInvoices = invoices.filter((i) => i.status === 'OVERDUE' || (new Date(i.dueDate) < new Date() && i.status !== 'PAID'))

    return NextResponse.json(apiResponse({ customer, invoices, payments, summary: { totalBilled, totalPaid, totalOutstanding, overdueCount: overdueInvoices.length } }))
  } catch {
    return NextResponse.json(apiError('Failed to generate statement'), { status: 500 })
  }
})
