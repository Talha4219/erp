import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const now = new Date()
    const weekOut = new Date(now.getTime() + 7 * 86400000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const [
      payablesAgg,
      pendingApprovalCount,
      dueThisWeekAgg,
      overdueAgg,
      paidThisMonthAgg,
      matchingExceptions,
      statusGroups,
      invoicesForTrend,
      paymentsForTrend,
      unpaidForAging,
      recentInvoices,
    ] = await Promise.all([
      prisma.vendorInvoice.aggregate({
        where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.vendorInvoice.count({ where: { deletedAt: null, status: 'DRAFT' } }),
      prisma.vendorInvoice.aggregate({
        where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] }, dueDate: { gte: now, lte: weekOut } },
        _count: { id: true },
      }),
      prisma.vendorInvoice.aggregate({
        where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] }, dueDate: { lt: now } },
        _sum: { totalAmount: true, paidAmount: true },
        _count: { id: true },
      }),
      prisma.vendorPayment.aggregate({
        where: { paymentDate: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.vendorInvoice.count({ where: { deletedAt: null, matchingStatus: 'MISMATCH' } }),
      prisma.vendorInvoice.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { id: true } }),
      prisma.vendorInvoice.findMany({
        where: { deletedAt: null, invoiceDate: { gte: sixMonthsAgo } },
        select: { invoiceDate: true, totalAmount: true },
      }),
      prisma.vendorPayment.findMany({
        where: { paymentDate: { gte: sixMonthsAgo } },
        select: { paymentDate: true, amount: true },
      }),
      prisma.vendorInvoice.findMany({
        where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] } },
        select: { totalAmount: true, paidAmount: true, dueDate: true },
      }),
      prisma.vendorInvoice.findMany({
        where: { deletedAt: null },
        include: { vendor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ])

    const totalPayables = Number(payablesAgg._sum.totalAmount ?? 0) - Number(payablesAgg._sum.paidAmount ?? 0)
    const overdueTotal = Number(overdueAgg._sum.totalAmount ?? 0) - Number(overdueAgg._sum.paidAmount ?? 0)

    const statusDistribution = statusGroups.map((g) => ({ status: g.status, count: g._count.id }))

    // Payables trend — invoices received vs paid, by month
    const byMonthReceived: Record<string, number> = {}
    for (const inv of invoicesForTrend) {
      const key = `${inv.invoiceDate.getFullYear()}-${String(inv.invoiceDate.getMonth() + 1).padStart(2, '0')}`
      byMonthReceived[key] = (byMonthReceived[key] ?? 0) + Number(inv.totalAmount)
    }
    const byMonthPaid: Record<string, number> = {}
    for (const p of paymentsForTrend) {
      const key = `${p.paymentDate.getFullYear()}-${String(p.paymentDate.getMonth() + 1).padStart(2, '0')}`
      byMonthPaid[key] = (byMonthPaid[key] ?? 0) + Number(p.amount)
    }
    let runningOutstanding = 0
    const payablesTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const received = byMonthReceived[key] ?? 0
      const paid = byMonthPaid[key] ?? 0
      runningOutstanding += received - paid
      return { month: key, received, paid, outstanding: Math.max(0, runningOutstanding) }
    })

    // Aging buckets — days past due
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    for (const inv of unpaidForAging) {
      const balance = Number(inv.totalAmount) - Number(inv.paidAmount)
      if (balance <= 0) continue
      const daysPastDue = Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000))
      if (daysPastDue <= 30) buckets['0-30'] += balance
      else if (daysPastDue <= 60) buckets['31-60'] += balance
      else if (daysPastDue <= 90) buckets['61-90'] += balance
      else buckets['90+'] += balance
    }
    const agingAnalysis = Object.entries(buckets).map(([bucket, amount]) => ({ bucket, amount }))

    return NextResponse.json(apiResponse({
      kpis: {
        totalPayables,
        pendingApproval: pendingApprovalCount,
        dueThisWeek: dueThisWeekAgg._count.id,
        overdueCount: overdueAgg._count.id,
        overdueTotal,
        paidThisMonth: Number(paidThisMonthAgg._sum.amount ?? 0),
        matchingExceptions,
      },
      statusDistribution,
      payablesTrend,
      agingAnalysis,
      recentInvoices,
    }))
  } catch (e) {
    console.error('[procurement/vendor-invoices/dashboard]', (e as Error).message)
    return NextResponse.json(apiError('Failed'), { status: 500 })
  }
})
