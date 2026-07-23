import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)

    const [
      revenueAgg,
      allOutstanding,
      overdueList,
      activeCustomers,
      openOrders,
      recentInvoices,
      topCustomerData,
      recentOrders,
      chartInvoices,
      leadCount,
      opportunityCount,
      quotationCount,
      orderCount,
      invoiceCount,
      topProductRows,
    ] = await Promise.all([
      prisma.customerInvoice.aggregate({
        where: { status: 'PAID', deletedAt: null },
        _sum: { paidAmount: true },
      }),
      prisma.customerInvoice.findMany({
        where: { status: { in: ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] }, deletedAt: null },
        select: { totalAmount: true, paidAmount: true },
      }),
      prisma.customerInvoice.findMany({
        where: { status: 'OVERDUE', deletedAt: null },
        select: { totalAmount: true, paidAmount: true },
      }),
      prisma.customer.count({ where: { isActive: true, deletedAt: null } }),
      prisma.salesOrder.count({ where: { status: { in: ['DRAFT', 'CONFIRMED'] }, deletedAt: null } }),
      prisma.customerInvoice.findMany({
        where: { deletedAt: null },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.customerInvoice.groupBy({
        by: ['customerId'],
        where: { deletedAt: null, NOT: { status: 'CANCELLED' } },
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 5,
      }),
      prisma.salesOrder.findMany({
        where: { deletedAt: null },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.customerInvoice.findMany({
        where: { invoiceDate: { gte: sixMonthsAgo }, deletedAt: null, status: { in: ['PAID', 'PARTIALLY_PAID'] } },
        select: { invoiceDate: true, paidAmount: true },
      }),
      prisma.crmLead.count({ where: { deletedAt: null } }),
      prisma.crmOpportunity.count({ where: { deletedAt: null } }),
      prisma.quotation.count({ where: { deletedAt: null } }),
      prisma.salesOrder.count({ where: { deletedAt: null, status: { not: 'CANCELLED' } } }),
      prisma.customerInvoice.count({ where: { deletedAt: null, status: { not: 'CANCELLED' } } }),
      prisma.invoiceItem.groupBy({
        by: ['itemId'],
        where: { itemId: { not: null }, invoice: { deletedAt: null, status: { not: 'CANCELLED' } } },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 5,
      }),
    ])

    const custIds = topCustomerData.map((c) => c.customerId)
    const custNames = await prisma.customer.findMany({
      where: { id: { in: custIds } },
      select: { id: true, name: true },
    })
    const custMap = Object.fromEntries(custNames.map((c) => [c.id, c.name]))

    const productIds = topProductRows.map((r) => r.itemId).filter((id): id is string => id !== null)
    const products = await prisma.item.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]))
    const topProducts = topProductRows.map((r) => ({
      name: productMap[r.itemId ?? ''] ?? 'Unknown',
      quantity: Number(r._sum.quantity ?? 0),
      revenue: Number(r._sum.totalPrice ?? 0),
    }))

    const funnel = [
      { stage: 'Leads', count: leadCount },
      { stage: 'Opportunities', count: opportunityCount },
      { stage: 'Quotations', count: quotationCount },
      { stage: 'Orders', count: orderCount },
      { stage: 'Invoices', count: invoiceCount },
    ]

    const monthLabels: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      monthLabels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }))
    }
    const monthlyMap: Record<string, number> = {}
    for (const label of monthLabels) monthlyMap[label] = 0
    for (const inv of chartInvoices) {
      const label = new Date(inv.invoiceDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (label in monthlyMap) monthlyMap[label] += Number(inv.paidAmount)
    }

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue: Number(revenueAgg._sum.paidAmount ?? 0),
        outstanding: allOutstanding.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0),
        overdueCount: overdueList.length,
        overdueAmount: overdueList.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0),
        activeCustomers,
        openOrders,
        monthlyRevenue: monthLabels.map((month) => ({ month, revenue: monthlyMap[month] })),
        recentInvoices,
        topCustomers: topCustomerData.map((c) => ({
          name: custMap[c.customerId] ?? 'Unknown',
          totalAmount: Number(c._sum.totalAmount ?? 0),
        })),
        recentOrders,
        funnel,
        topProducts,
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
