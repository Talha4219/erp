import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { customerSchema } from '@/lib/validations/sales'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const [customer, documents] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: params.id },
        include: {
          contacts: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, jobTitle: true, isActive: true } },
          quotations: { where: { deletedAt: null }, select: { id: true, quotationNumber: true, quotationDate: true, status: true, totalAmount: true }, orderBy: { quotationDate: 'desc' } },
          salesOrders: { where: { deletedAt: null }, select: { id: true, soNumber: true, status: true, orderDate: true, totalAmount: true }, orderBy: { orderDate: 'desc' } },
          invoices: {
            where: { deletedAt: null },
            select: { id: true, invoiceNumber: true, status: true, totalAmount: true, paidAmount: true, invoiceDate: true, payments: { select: { id: true, paymentDate: true, amount: true, method: true, reference: true }, orderBy: { paymentDate: 'desc' } } },
            orderBy: { invoiceDate: 'desc' },
          },
          returns: { where: { deletedAt: null }, select: { id: true, returnNumber: true, returnDate: true, status: true, totalAmount: true }, orderBy: { returnDate: 'desc' } },
          ratings: { orderBy: { ratedAt: 'desc' }, take: 20 },
          opportunities: { where: { deletedAt: null }, select: { id: true, title: true, stage: true, value: true, createdAt: true, lead: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.businessDocument.findMany({
        where: { entityType: 'Customer', entityId: params.id },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    if (!customer) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const totalRevenue = customer.invoices.reduce((s, i) => s + Number(i.paidAmount), 0)
    const outstandingAmount = customer.invoices
      .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
      .reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
    const openOrders = customer.salesOrders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status)).length
    const lastPurchase = customer.invoices[0]?.invoiceDate ?? customer.salesOrders[0]?.orderDate ?? null
    const paymentHistory = customer.invoices
      .flatMap((i) => i.payments.map((p) => ({ ...p, invoiceNumber: i.invoiceNumber })))
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())

    return NextResponse.json({
      success: true,
      data: { ...customer, documents, totalRevenue, outstandingAmount, openOrders, lastPurchase, paymentHistory },
    })
  } catch (err) {
    console.error('[sales/customers/:id]', (err as Error).message)
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }
})

export const PUT = withAuth<Params>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const parsed = customerSchema.partial().safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: parsed.data,
      select: { id: true, name: true, email: true, phone: true, address: true, city: true, country: true, contactPerson: true, taxId: true, creditLimit: true, paymentTerms: true, isActive: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    await prisma.customer.update({
      where: { id: params.id },
      data: { isActive: false, deletedAt: new Date() },
    })
    return NextResponse.json({ success: true, data: null })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
