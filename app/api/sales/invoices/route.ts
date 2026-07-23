import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { customerInvoiceSchema } from '@/lib/validations/sales'
import { nextDocNumber } from '@/lib/services/numbering'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { getUserCompanyId, companyScope } from '@/lib/company-scope'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id!)
  try {
    const invoices = await prisma.customerInvoice.findMany({
      where: { deletedAt: null, ...companyScope(companyId) },
      include: { customer: { select: { id: true, name: true } }, lineItems: true },
      orderBy: { dueDate: 'asc' },
      take: 100,
    })
    return NextResponse.json({ success: true, data: invoices })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function postHandler(req: NextRequest, { session }: { session: import('@/lib/api-middleware').AuthedSession }) {
  const body = await req.json()
  const parsed = customerInvoiceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { customerId, soId, invoiceDate, dueDate, notes, lineItems } = parsed.data

  const processedItems = lineItems.map((li) => {
    const totalPrice = li.quantity * li.unitPrice * (1 - li.discount / 100) * (1 + li.taxRate / 100)
    return { ...li, totalPrice }
  })

  const subTotal = processedItems.reduce((s, li) => s + li.totalPrice, 0)
  const taxAmount = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice * li.taxRate / 100, 0)
  const discountAmount = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice * li.discount / 100, 0)
  const totalAmount = subTotal + taxAmount - discountAmount

  try {
    const invoiceNumber = await nextDocNumber('customer_invoice')
    const companyId = await getUserCompanyId(session.user.id!)

    const invoice = await prisma.customerInvoice.create({
      data: {
        invoiceNumber,
        customerId,
        companyId: companyId ?? undefined,
        soId,
        invoiceDate: new Date(invoiceDate),
        dueDate: new Date(dueDate),
        notes,
        subTotal,
        taxAmount,
        totalAmount,
        lineItems: { create: processedItems },
      },
      include: { customer: { select: { id: true, name: true } }, lineItems: true },
    })
    return NextResponse.json({ success: true, data: invoice }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const POST = withRateLimit(withAudit(withAuth(postHandler) as Parameters<typeof withAudit>[0], 'CustomerInvoice'))
