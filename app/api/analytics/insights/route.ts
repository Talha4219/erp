import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Last 12 months range
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    const [
      revenueMTD, revenuePrevMonth, revenueYTD,
      arOutstanding, apDueWeek,
      openSalesOrders, openPOs,
      lowStockCount, totalEmployees, activeEmployees,
      pendingLeaves, pendingApprovals,
      payments12m, topVendors,
      salesOrders12m, purchaseOrders12m,
    ] = await Promise.all([
      prisma.customerPayment.aggregate({ where: { paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.customerPayment.aggregate({ where: { paymentDate: { gte: prevMonthStart, lt: monthStart } }, _sum: { amount: true } }),
      prisma.customerPayment.aggregate({ where: { paymentDate: { gte: yearStart } }, _sum: { amount: true } }),
      prisma.customerInvoice.aggregate({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.vendorInvoice.aggregate({
        where: { status: { notIn: ['PAID', 'CANCELLED'] }, dueDate: { lte: weekEnd } },
        _sum: { totalAmount: true },
      }),
      prisma.salesOrder.count({ where: { status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
      prisma.purchaseOrder.count({ where: { status: { notIn: ['FULLY_RECEIVED', 'CANCELLED'] } } }),
      prisma.item.count({ where: { deletedAt: null, warehouseStocks: { none: {} } } }),
      prisma.employee.count(),
      prisma.employee.count({ where: { isActive: true } }),
      prisma.leave.count({ where: { status: 'PENDING' } }),
      prisma.workflowInstance.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),

      // Revenue by month (last 12)
      prisma.customerPayment.findMany({
        where: { paymentDate: { gte: twelveMonthsAgo } },
        select: { paymentDate: true, amount: true },
      }),

      // Top vendors by spend YTD
      prisma.purchaseOrder.groupBy({
        by: ['vendorId'],
        where: {
          orderDate: { gte: yearStart },
          status: { notIn: ['CANCELLED'] },
        },
        _sum: { grandTotal: true },
        orderBy: { _sum: { grandTotal: 'desc' } },
        take: 5,
      }),

      // Sales orders by month (count)
      prisma.salesOrder.findMany({
        where: { orderDate: { gte: twelveMonthsAgo }, status: { not: 'CANCELLED' } },
        select: { orderDate: true, totalAmount: true },
      }),

      // Purchase orders by month
      prisma.purchaseOrder.findMany({
        where: { orderDate: { gte: twelveMonthsAgo }, status: { not: 'CANCELLED' } },
        select: { orderDate: true, grandTotal: true },
      }),
    ])

    // Build 12-month revenue array
    const revenueMap: Record<string, number> = {}
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
      revenueMap[key] = 0
    }
    for (const p of payments12m) {
      const d = new Date(p.paymentDate)
      const key = d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
      if (key in revenueMap) revenueMap[key] += Number(p.amount)
    }
    const monthlyRevenue = Object.entries(revenueMap).map(([month, revenue]) => ({ month, revenue }))

    // Build 12-month orders array
    const ordersMap: Record<string, { sales: number; purchase: number; salesValue: number; purchaseValue: number }> = {}
    for (const k of Object.keys(revenueMap)) ordersMap[k] = { sales: 0, purchase: 0, salesValue: 0, purchaseValue: 0 }
    for (const o of salesOrders12m) {
      const key = new Date(o.orderDate).toLocaleString('en-GB', { month: 'short', year: '2-digit' })
      if (key in ordersMap) { ordersMap[key].sales += 1; ordersMap[key].salesValue += Number(o.totalAmount) }
    }
    for (const o of purchaseOrders12m) {
      const key = new Date(o.orderDate).toLocaleString('en-GB', { month: 'short', year: '2-digit' })
      if (key in ordersMap) { ordersMap[key].purchase += 1; ordersMap[key].purchaseValue += Number(o.grandTotal) }
    }
    const monthlyOrders = Object.entries(ordersMap).map(([month, v]) => ({ month, ...v }))

    // Top vendors with names
    const vendorIds = topVendors.map((v: { vendorId: string }) => v.vendorId)
    const vendors = vendorIds.length
      ? await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } })
      : []
    const vendorMap = Object.fromEntries(vendors.map(v => [v.id, v.name]))
    const topVendorList = topVendors.map((v: { vendorId: string; _sum: { grandTotal: unknown } }) => ({
      name: vendorMap[v.vendorId] ?? 'Unknown',
      spend: Number(v._sum.grandTotal ?? 0),
    }))

    // AR metrics
    const arBalance = Number(arOutstanding._sum.totalAmount ?? 0) - Number(arOutstanding._sum.paidAmount ?? 0)

    // MoM revenue change
    const revMtd = Number(revenueMTD._sum.amount ?? 0)
    const revPrev = Number(revenuePrevMonth._sum.amount ?? 0)
    const revMoMPct = revPrev > 0 ? ((revMtd - revPrev) / revPrev) * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          revenueMTD: revMtd,
          revenueYTD: Number(revenueYTD._sum.amount ?? 0),
          revenueMoMPct: revMoMPct,
          arOutstanding: arBalance,
          apDueThisWeek: Number(apDueWeek._sum.totalAmount ?? 0),
          openSalesOrders,
          openPurchaseOrders: openPOs,
          lowStockItems: lowStockCount,
          totalEmployees,
          activeEmployees,
          pendingLeaves,
          pendingApprovals,
        },
        monthlyRevenue,
        monthlyOrders,
        topVendors: topVendorList,
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
