import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { withAuth } from '@/lib/api-middleware'

const CACHE_TTL = 60_000 // 60s

export const GET = withAuth(async () => {
  const cacheKey = 'analytics:dashboard'
  const cached = cache.get(cacheKey)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [
      revenueToday,
      revenueMTD,
      arOutstanding,
      apDueThisWeek,
      lowStockCount,
      pendingApprovals,
      openOrders,
      pendingInvoices,
    ] = await Promise.all([
      // Revenue today (paid invoices)
      prisma.customerPayment.aggregate({
        where: { paymentDate: { gte: todayStart } },
        _sum: { amount: true },
      }),
      // Revenue MTD
      prisma.customerPayment.aggregate({
        where: { paymentDate: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // AR outstanding (sent + partially paid invoices)
      prisma.customerInvoice.aggregate({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      // AP due this week (vendor invoices)
      prisma.vendorInvoice.aggregate({
        where: {
          status: { notIn: ['PAID', 'CANCELLED'] },
          dueDate: { lte: weekEnd },
        },
        _sum: { totalAmount: true },
      }),
      // Low stock items
      prisma.item.count({
        where: {
          reorderPoint: { gt: 0 },
          warehouseStocks: { none: {} },
        },
      }),
      // Pending workflow approvals
      prisma.workflowInstance.count({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      // Open sales orders
      prisma.salesOrder.count({
        where: { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      }),
      // Pending purchase orders
      prisma.purchaseOrder.count({
        where: { status: { notIn: ['FULLY_RECEIVED', 'CANCELLED'] } },
      }),
    ])

    const arBalance =
      Number(arOutstanding._sum.totalAmount ?? 0) -
      Number(arOutstanding._sum.paidAmount ?? 0)

    const data = {
      revenue: {
        today: Number(revenueToday._sum.amount ?? 0),
        mtd: Number(revenueMTD._sum.amount ?? 0),
      },
      ar: { outstanding: arBalance },
      ap: { dueThisWeek: Number(apDueThisWeek._sum.totalAmount ?? 0) },
      inventory: { lowStockItems: lowStockCount },
      workflow: { pendingApprovals },
      orders: { openSalesOrders: openOrders, pendingPurchaseOrders: pendingInvoices },
    }

    cache.set(cacheKey, data, CACHE_TTL)

    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
