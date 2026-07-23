import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthedSession } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (_req: NextRequest, { params }: { params: { id: string } } & { session: AuthedSession }) => {
  const id = parseInt(params.id)
  try {
    const customer = await prisma.retailCustomer.findUnique({
      where: { id },
      include: { addresses: true },
    })
    if (!customer) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const rows: string[] = [
      'Section,Field,Value',
      `Customer,ID,${customer.id}`,
      `Customer,Name,"${customer.firstName} ${customer.lastName}"`,
      `Customer,Email,${customer.email}`,
      `Customer,Phone,${customer.phone ?? ''}`,
      `Customer,DOB,${customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString('en-GB') : ''}`,
      `Customer,Loyalty Points,${customer.loyaltyPointsBalance}`,
      `Customer,Marketing Opt-In,${customer.marketingOptIn}`,
      `Customer,GDPR Consent Date,${customer.gdprConsentDate ? new Date(customer.gdprConsentDate).toLocaleDateString('en-GB') : ''}`,
    ]

    for (const addr of customer.addresses) {
      rows.push(`Address,${addr.addressLine1} ${addr.city} ${addr.postcode},${addr.isPrimary ? 'Primary' : ''}`)
    }

    const orders = await prisma.salesOrderV2.findMany({
      where: { channel: 'POS', orderDate: { gte: new Date(new Date().getFullYear(), 0, 1) } },
      include: { lineItems: { include: { item: { select: { name: true } } } } },
      orderBy: { orderDate: 'desc' },
    })
    for (const order of orders) {
      rows.push(`Transaction,Date,${new Date(order.orderDate).toLocaleDateString('en-GB')}`)
      rows.push(`Transaction,Total,£${Number(order.totalAmount).toFixed(2)}`)
      rows.push(`Transaction,ID,${order.orderNumber}`)
      for (const li of order.lineItems) {
        const name = li.item?.name ?? li.description
        rows.push(`Transaction Line,${name},Qty ${li.quantity} @ £${Number(li.unitPrice).toFixed(2)}`)
      }
    }

    const csv = rows.join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="sar-customer-${id}.csv"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
