import prisma from '@/lib/prisma'

export async function getAnalyticsDashboard() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [
    revenueToday, revenueMTD, arOutstanding, apDueThisWeek,
    lowStockCount, pendingApprovals, openOrders, pendingInvoices,
  ] = await Promise.all([
    prisma.customerPayment.aggregate({ where: { paymentDate: { gte: todayStart } }, _sum: { amount: true } }),
    prisma.customerPayment.aggregate({ where: { paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.customerInvoice.aggregate({ where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } }, _sum: { totalAmount: true, paidAmount: true } }),
    prisma.vendorInvoice.aggregate({ where: { status: { notIn: ['PAID', 'CANCELLED'] }, dueDate: { lte: weekEnd } }, _sum: { totalAmount: true } }),
    prisma.item.count({ where: { reorderPoint: { gt: 0 }, warehouseStocks: { none: {} } } }),
    prisma.workflowInstance.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
    prisma.salesOrder.count({ where: { status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
    prisma.purchaseOrder.count({ where: { status: { notIn: ['FULLY_RECEIVED', 'CANCELLED'] } } }),
  ])

  const arBalance = Number(arOutstanding._sum.totalAmount ?? 0) - Number(arOutstanding._sum.paidAmount ?? 0)

  return {
    revenue: { today: Number(revenueToday._sum.amount ?? 0), mtd: Number(revenueMTD._sum.amount ?? 0) },
    ar: { outstanding: arBalance },
    ap: { dueThisWeek: Number(apDueThisWeek._sum.totalAmount ?? 0) },
    inventory: { lowStockItems: lowStockCount },
    workflow: { pendingApprovals },
    orders: { openSalesOrders: openOrders, pendingPurchaseOrders: pendingInvoices },
  }
}

export async function getInsights(userId: string) {
  const activeDelegations = await prisma.approvalDelegation.count({
    where: { delegateeId: userId, isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
  })
  const pendingActions = await prisma.workflowInstance.count({
    where: { status: 'PENDING', requestedById: { not: userId } },
  })
  const [myOpenTasks, unreadNotifications] = await Promise.all([
    prisma.projectTask.count({ where: { assigneeId: userId, status: { notIn: ['DONE', 'BLOCKED'] } } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ])
  return { activeDelegations, pendingActions, myOpenTasks, unreadNotifications }
}
