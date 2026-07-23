import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { withAuth } from '@/lib/api-middleware'

const CACHE_TTL = 30_000 // 30s for main dashboard (more real-time feel)

export const GET = withAuth(async (_req, { session }) => {
  const cacheKey = 'dashboard:main'
  const cached = cache.get(cacheKey)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  const now = new Date()
  const year = now.getFullYear()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  try {
    const [
      recentInvoices, openPOs, pendingLeaves, lowStockItems, expenseCategories,
      revenueToday, paymentMTDAgg, pendingApprovals,
      openSalesOrders, arCurrent, ar30, ar60, ar90plus,
      apDueWeek, apDueToday, bankAccounts,
      recentNotifications, pendingWorkflow, allPendingWorkflow,
      topCustomers,
      pendingPOApprovals, pendingPRApprovals, overdueInvoiceCount, recentPOs, recentPRs, recentLeaves,
    ] = await Promise.all([
      prisma.customerInvoice.findMany({
        where: { deletedAt: null },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.purchaseOrder.count({
        where: { status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] }, deletedAt: null },
      }),
      prisma.leave.count({ where: { status: 'PENDING' } }),
      prisma.item.findMany({
        where: { isActive: true, deletedAt: null, reorderPoint: { gt: 0 } },
        include: { warehouseStocks: true },
        take: 8,
      }),
      prisma.expenseCategory.findMany({
        include: {
          expenses: { where: { deletedAt: null }, select: { amountGbp: true } },
        },
      }),
      // ERP KPIs
      prisma.customerPayment.aggregate({ where: { paymentDate: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.customerPayment.aggregate({ where: { paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.workflowInstance.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.salesOrder.count({ where: { status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
      // AR aging buckets
      prisma.customerInvoice.aggregate({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID'] }, dueDate: { gte: now } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.customerInvoice.aggregate({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] }, dueDate: { gte: thirtyDaysAgo, lt: now } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.customerInvoice.aggregate({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] }, dueDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.customerInvoice.aggregate({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] }, dueDate: { lt: sixtyDaysAgo } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      // AP due this week
      prisma.vendorInvoice.aggregate({
        where: { status: { notIn: ['PAID', 'CANCELLED'] }, dueDate: { lte: weekEnd } },
        _sum: { totalAmount: true },
      }),
      // AP due today
      prisma.vendorInvoice.count({
        where: { status: { notIn: ['PAID', 'CANCELLED'] }, dueDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) } },
      }),
      // Bank accounts cash position
      prisma.bankAccount.findMany({
        where: { isActive: true },
        select: { id: true, accountName: true, accountType: true, currentBalance: true, currency: true },
        take: 6,
      }),
      // Recent notifications (last 5)
      prisma.notification.findMany({
        where: { userId: session.user.id! },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, body: true, type: true, isRead: true, createdAt: true, actionUrl: true },
      }),
      // Pending workflow items
      prisma.workflowInstance.findMany({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        include: {
          definition: { select: { name: true, module: true } },
          requester: { select: { name: true, email: true } },
        },
        orderBy: { requestedAt: 'desc' },
        take: 5,
      }),
      // All pending workflow items (for My Tasks + category breakdown — no take limit)
      prisma.workflowInstance.findMany({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        include: {
          definition: { include: { steps: { orderBy: { stepOrder: 'asc' }, take: 1 } } },
          requester: { select: { name: true, email: true } },
        },
        orderBy: { requestedAt: 'desc' },
      }),
      // Top 5 customers by invoice total (MTD)
      prisma.$queryRaw<Array<{ name: string; total: number }>>`
        SELECT c.name, COALESCE(SUM(ci."totalAmount"), 0)::float as total
        FROM "Customer" c
        JOIN "CustomerInvoice" ci ON ci."customerId" = c.id
        WHERE ci."invoiceDate" >= ${monthStart} AND ci."deletedAt" IS NULL
        GROUP BY c.id, c.name
        ORDER BY total DESC
        LIMIT 5
      `,
      // PO awaiting approval specifically
      prisma.purchaseOrder.count({ where: { status: 'PENDING_APPROVAL', deletedAt: null } }),
      // PR awaiting approval specifically
      prisma.purchaseRequisition.count({ where: { status: 'PENDING', deletedAt: null } }),
      // Overdue customer invoices
      prisma.customerInvoice.count({ where: { status: 'OVERDUE', deletedAt: null } }),
      // Cross-module recent activity
      prisma.purchaseOrder.findMany({
        where: { deletedAt: null },
        include: { vendor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.purchaseRequisition.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.leave.findMany({
        where: {},
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    // ── POS revenue & expense (feeds the same KPIs as invoiced sales) ────────
    const [posToday, posMTD, posRefunds, posCogs] = await Promise.all([
      prisma.salesOrderV2.aggregate({
        where: { channel: 'POS', orderDate: { gte: todayStart } },
        _sum: { subTotal: true, totalAmount: true },
      }),
      prisma.salesOrderV2.aggregate({
        where: { channel: 'POS', orderDate: { gte: monthStart } },
        _sum: { subTotal: true, totalAmount: true },
      }),
      (async () => {
        const mtdRefunds = await prisma.salesPayment.findMany({
          where: { method: 'REFUND', paidAt: { gte: monthStart } },
          include: { soItem: { select: { taxRate: true } } },
        })
        const netToday = mtdRefunds
          .filter((r) => r.paidAt && r.paidAt >= todayStart)
          .reduce((s, r) => s + Number(r.amount) / (1 + Number(r.soItem?.taxRate ?? 0)), 0)
        const netMtd = mtdRefunds
          .reduce((s, r) => s + Number(r.amount) / (1 + Number(r.soItem?.taxRate ?? 0)), 0)
        return [{ net_today: netToday, net_mtd: netMtd }]
      })(),
      // COGS from the inventory ledger: POS sales minus restocked returns
      prisma.$queryRaw<Array<{ cogs_today: number; cogs_mtd: number }>>`
        SELECT
          COALESCE(SUM(CASE WHEN "referenceType" = 'POS' THEN "totalCost" ELSE -"totalCost" END)
            FILTER (WHERE "transactionDate" >= ${todayStart}), 0)::float AS cogs_today,
          COALESCE(SUM(CASE WHEN "referenceType" = 'POS' THEN "totalCost" ELSE -"totalCost" END), 0)::float AS cogs_mtd
        FROM "StockLedger"
        WHERE "referenceType" IN ('POS', 'POS_RETURN') AND "transactionDate" >= ${monthStart}
      `,
    ])
    // POS revenue = net sales (ex VAT) minus net refunds
    const posRevenueToday = Number(posToday._sum.subTotal ?? 0) - (posRefunds[0]?.net_today ?? 0)
    const posRevenueMTD = Number(posMTD._sum.subTotal ?? 0) - (posRefunds[0]?.net_mtd ?? 0)
    const posCogsToday = posCogs[0]?.cogs_today ?? 0
    const posCogsMTD = posCogs[0]?.cogs_mtd ?? 0

    // Monthly revenue for last 12 months — single aggregation query instead of 12
    const twelveMonthsAgo = new Date(year, now.getMonth() - 11, 1)
    const rawRevenue = await prisma.$queryRaw<Array<{ yr: number; mo: number; revenue: number }>>`
      SELECT EXTRACT(YEAR FROM "invoiceDate")::int  AS yr,
             EXTRACT(MONTH FROM "invoiceDate")::int AS mo,
             COALESCE(SUM("totalAmount"), 0)::float AS revenue
      FROM   "CustomerInvoice"
      WHERE  status IN ('PAID', 'PARTIALLY_PAID')
        AND  "deletedAt" IS NULL
        AND  "invoiceDate" >= ${twelveMonthsAgo}
      GROUP  BY yr, mo
    `

    const revenueByKey = Object.fromEntries(rawRevenue.map(r => [`${r.yr}-${r.mo}`, r.revenue]))
    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(year, now.getMonth() - (11 - i), 1)
      return {
        month: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        revenue: revenueByKey[`${d.getFullYear()}-${d.getMonth() + 1}`] ?? 0,
      }
    })

    const revenueMTD = revenueByKey[`${year}-${now.getMonth() + 1}`] ?? 0

    const arBucket = (agg: typeof arCurrent) =>
      Math.max(0, Number(agg._sum.totalAmount ?? 0) - Number(agg._sum.paidAmount ?? 0))

    const totalCash = bankAccounts.reduce((s: number, b: any) => s + Number(b.currentBalance), 0)

    const lowStockList = lowStockItems.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      reorderPoint: Number(item.reorderPoint),
      currentStock: item.warehouseStocks.reduce((s: number, ws: any) => s + Number(ws.quantity), 0),
    })).filter((i) => i.currentStock <= i.reorderPoint)
    const outOfStockCount = lowStockList.filter((i) => i.currentStock <= 0).length

    const workflowAlerts = {
      approvals: [
        { label: 'Purchase Requests Awaiting Approval', count: pendingPRApprovals, href: '/procurement/purchase-requests' },
        { label: 'Purchase Orders Awaiting Approval', count: pendingPOApprovals, href: '/procurement/purchase-orders' },
        { label: 'Leave Requests Pending', count: pendingLeaves, href: '/hr/leave' },
      ].filter((a) => a.count > 0),
      financial: [
        { label: 'Overdue Customer Invoices', count: overdueInvoiceCount, href: '/sales/invoices' },
        { label: 'Supplier Payments Due Today', count: apDueToday, href: '/procurement/purchase-invoices' },
      ].filter((a) => a.count > 0),
      inventory: [
        { label: 'Low Stock Items', count: lowStockList.length, href: '/inventory/items' },
        { label: 'Out Of Stock Products', count: outOfStockCount, href: '/inventory/items' },
      ].filter((a) => a.count > 0),
    }

    // My Tasks: pending workflow instances actionable by the current user (by role on the first step, or admins)
    const myRole = session.user.role as string | undefined
    const isAdmin = myRole === 'SUPER_ADMIN' || myRole === 'ADMIN'
    const myTasks = allPendingWorkflow
      .filter((w) => {
        const step = w.definition.steps[0]
        if (!step) return isAdmin
        return isAdmin || step.approverId === session.user.id || (step.approverRole && step.approverRole === myRole)
      })
      .slice(0, 8)
      .map((w) => ({
        id: w.id,
        workflow: w.definition.name,
        module: w.definition.module,
        requester: w.requester.name ?? w.requester.email,
        requestedAt: w.requestedAt,
      }))

    const crossModuleActivity = [
      ...recentInvoices.map((inv) => ({
        id: inv.id, type: 'invoice',
        description: `Invoice ${inv.invoiceNumber} for ${inv.customer.name}`,
        amount: Number(inv.totalAmount), date: inv.invoiceDate, status: inv.status,
      })),
      ...recentPOs.map((po) => ({
        id: po.id, type: 'po',
        description: `PO ${po.poNumber} for ${po.vendor.name}`,
        amount: Number(po.grandTotal), date: po.createdAt, status: po.status,
      })),
      ...recentPRs.map((pr) => ({
        id: pr.id, type: 'pr',
        description: `Purchase Requisition ${pr.prNumber}`,
        amount: Number(pr.totalAmount), date: pr.createdAt, status: pr.status,
      })),
      ...recentLeaves.map((l) => ({
        id: l.id, type: 'leave',
        description: `Leave request — ${l.employee.firstName} ${l.employee.lastName}`,
        amount: 0, date: l.createdAt, status: l.status,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)

    const data = {
        kpis: {
          revenueMTD,
          openPOs,
          pendingLeaves,
          lowStockAlerts: lowStockItems.filter(
            (i: any) => i.warehouseStocks.reduce((s: number, ws: any) => s + Number(ws.quantity), 0) <= Number(i.reorderPoint ?? 0)
          ).length,
          // ERP KPIs — invoiced payments + POS takings combined
          revenueToday: Number(revenueToday._sum.amount ?? 0) + posRevenueToday,
          revenueMTDFromPayments: Number(paymentMTDAgg._sum.amount ?? 0) + posRevenueMTD,
          // POS breakdown (net of VAT and refunds; COGS from the stock ledger)
          posRevenueToday,
          posRevenueMTD,
          posCogsToday,
          posCogsMTD,
          posGrossProfitMTD: posRevenueMTD - posCogsMTD,
          pendingApprovals,
          openSalesOrders,
          apDueThisWeek: Number(apDueWeek._sum.totalAmount ?? 0),
          arOutstanding: arBucket(arCurrent) + arBucket(ar30) + arBucket(ar60) + arBucket(ar90plus),
          cashPosition: totalCash,
        },
        arAging: {
          current: arBucket(arCurrent),
          days30: arBucket(ar30),
          days60: arBucket(ar60),
          days90plus: arBucket(ar90plus),
        },
        monthlyRevenue,
        lowStockItems: lowStockList,
        expenseBreakdown: expenseCategories
          .map((c) => ({
            name: c.categoryName,
            value: c.expenses.reduce((s: number, e: any) => s + Number(e.amountGbp), 0),
          }))
          .filter((c) => c.value > 0),
        recentActivity: crossModuleActivity,
        bankAccounts,
        recentNotifications,
        pendingWorkflow: pendingWorkflow.map((w) => ({
          id: w.id,
          workflow: w.definition.name,
          module: w.definition.module,
          requester: w.requester.name ?? w.requester.email,
          requestedAt: w.requestedAt,
          status: w.status,
        })),
        topCustomers,
        workflowAlerts,
        myTasks,
      }

    cache.set(cacheKey, data, CACHE_TTL)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
