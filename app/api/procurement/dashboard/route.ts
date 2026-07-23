import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalVendors,
      openPOs,
      openPRs,
      pendingGRNs,
      pendingApprovals,
      unpaidInvoices,
      overdueInvoices,
      recentPOs,
      pendingReturns,
      monthlyOrders,
      topSupplierRows,
      recentPRs,
      recentGRNs,
      // Pipeline stage counts
      draftPRs,
      pendingPRs,
      approvedPRs,
      pendingApprovalPOs,
      approvedPOs,
      partialGRNs,
      fullyReceivedPOs,
      // Delivery performance: POs with expected delivery date passed but not fully received
      overdueDeliveries,
      // All fully received POs for cycle time calc
      completedPOs,
    ] = await Promise.all([
      prisma.vendor.count({ where: { deletedAt: null, isActive: true } }),
      prisma.purchaseOrder.count({ where: { deletedAt: null, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED'] } } }),
      prisma.purchaseRequisition.count({ where: { deletedAt: null, status: { in: ['DRAFT', 'PENDING', 'APPROVED'] } } }),
      prisma.purchaseOrder.count({ where: { deletedAt: null, status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } } }),
      Promise.all([
        prisma.purchaseRequisition.count({ where: { deletedAt: null, status: 'PENDING' } }),
        prisma.purchaseOrder.count({ where: { deletedAt: null, status: 'PENDING_APPROVAL' } }),
      ]).then(([pr, po]) => pr + po),
      prisma.vendorInvoice.aggregate({
        where: { deletedAt: null, status: { in: ['DRAFT', 'SENT', 'PARTIALLY_PAID'] } },
        _sum: { totalAmount: true, paidAmount: true },
        _count: { id: true },
      }),
      // Overdue: past due date and still unpaid
      prisma.vendorInvoice.aggregate({
        where: { deletedAt: null, status: { in: ['SENT', 'PARTIALLY_PAID'] }, dueDate: { lt: now } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { deletedAt: null },
        include: { vendor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.purchaseReturn.count({ where: { deletedAt: null, status: { in: ['DRAFT', 'APPROVED'] } } }),
      prisma.purchaseOrder.findMany({
        where: { deletedAt: null, status: { not: 'CANCELLED' }, orderDate: { gte: sixMonthsAgo } },
        select: { orderDate: true, grandTotal: true },
      }),
      prisma.purchaseOrder.groupBy({
        by: ['vendorId'],
        where: { deletedAt: null, status: { not: 'CANCELLED' } },
        _sum: { grandTotal: true },
        _count: { id: true },
        orderBy: { _sum: { grandTotal: 'desc' } },
        take: 5,
      }),
      prisma.purchaseRequisition.findMany({
        where: { deletedAt: null },
        select: { id: true, prNumber: true, status: true, createdAt: true, department: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.goodsReceiptNote.findMany({
        where: {},
        select: { id: true, grnNumber: true, receivedDate: true, createdAt: true, po: { select: { vendor: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Pipeline stage counts
      prisma.purchaseRequisition.count({ where: { deletedAt: null, status: 'DRAFT' } }),
      prisma.purchaseRequisition.count({ where: { deletedAt: null, status: 'PENDING' } }),
      prisma.purchaseRequisition.count({ where: { deletedAt: null, status: 'APPROVED' } }),
      prisma.purchaseOrder.count({ where: { deletedAt: null, status: 'PENDING_APPROVAL' } }),
      prisma.purchaseOrder.count({ where: { deletedAt: null, status: 'APPROVED' } }),
      prisma.purchaseOrder.count({ where: { deletedAt: null, status: 'PARTIALLY_RECEIVED' } }),
      prisma.purchaseOrder.count({ where: { deletedAt: null, status: 'FULLY_RECEIVED' } }),
      // Delivery overdue: POs in approved/partial state for more than 30 days
      prisma.purchaseOrder.count({
        where: {
          deletedAt: null,
          status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] },
          orderDate: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      // Recently completed POs for cycle time
      prisma.purchaseOrder.findMany({
        where: { deletedAt: null, status: 'FULLY_RECEIVED', pr: { isNot: null } },
        select: { createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ])

    // Full procurement funnel: real counts per document type
    const [rfqCount, quotationCount, grnCount, invoiceCount, paymentCount, supplierRatingRows] = await Promise.all([
      prisma.rfq.count({ where: { deletedAt: null } }),
      prisma.supplierQuotation.count({ where: { deletedAt: null } }),
      prisma.goodsReceiptNote.count(),
      prisma.vendorInvoice.count({ where: { deletedAt: null } }),
      prisma.vendorPayment.count(),
      prisma.supplierRating.groupBy({
        by: ['vendorId'],
        _avg: { overallScore: true },
        orderBy: { _avg: { overallScore: 'desc' } },
        take: 5,
      }),
    ])
    const totalPRsAllTime = await prisma.purchaseRequisition.count({ where: { deletedAt: null } })
    const totalPOsAllTime = await prisma.purchaseOrder.count({ where: { deletedAt: null, status: { not: 'CANCELLED' } } })

    const funnel = [
      { stage: 'Purchase Requests', count: totalPRsAllTime, color: '#8b5cf6' },
      { stage: 'RFQs',              count: rfqCount,        color: '#6366f1' },
      { stage: 'Quotations',        count: quotationCount,  color: '#3b82f6' },
      { stage: 'Purchase Orders',   count: totalPOsAllTime, color: '#0ea5e9' },
      { stage: 'GRNs',              count: grnCount,        color: '#10b981' },
      { stage: 'Invoices',          count: invoiceCount,    color: '#22c55e' },
      { stage: 'Payments',          count: paymentCount,    color: '#84cc16' },
    ]

    const ratedVendorIds = supplierRatingRows.map((r) => r.vendorId)
    const ratedVendors = ratedVendorIds.length
      ? await prisma.vendor.findMany({ where: { id: { in: ratedVendorIds } }, select: { id: true, name: true } })
      : []
    const ratedVendorMap = Object.fromEntries(ratedVendors.map((v) => [v.id, v.name]))
    const supplierPerformance = supplierRatingRows.map((r) => ({
      name: ratedVendorMap[r.vendorId] ?? 'Unknown',
      score: Math.round(Number(r._avg.overallScore ?? 0) * 20), // 1-5 scale -> percentage
    }))

    const totalUnpaid = Number(unpaidInvoices._sum.totalAmount ?? 0) - Number(unpaidInvoices._sum.paidAmount ?? 0)

    // Monthly spend aggregation
    const byMonth: Record<string, number> = {}
    for (const o of monthlyOrders) {
      const key = `${o.orderDate.getFullYear()}-${String(o.orderDate.getMonth() + 1).padStart(2, '0')}`
      byMonth[key] = (byMonth[key] ?? 0) + Number(o.grandTotal)
    }
    const monthlySpend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return { month: key, total: byMonth[key] ?? 0 }
    })

    const thisMonthSpend = monthlyOrders
      .filter((o) => o.orderDate >= monthStart)
      .reduce((s, o) => s + Number(o.grandTotal), 0)

    // Top suppliers
    const vendorIds = topSupplierRows.map((r) => r.vendorId)
    const vendors = await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } })
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]))
    const topSuppliers = topSupplierRows.map((r) => ({
      name: vendorMap[r.vendorId]?.name ?? 'Unknown',
      totalSpend: Number(r._sum.grandTotal ?? 0),
      poCount: r._count.id,
    }))

    // Activity feed
    const activities = [
      ...recentPRs.map((p) => ({ type: 'PR' as const, id: p.id, ref: p.prNumber, status: p.status, label: p.department ?? 'Purchase Request', date: p.createdAt })),
      ...recentPOs.map((p) => ({ type: 'PO' as const, id: p.id, ref: p.poNumber, status: p.status, label: p.vendor.name, date: p.createdAt })),
      ...recentGRNs.map((g) => ({ type: 'GRN' as const, id: g.id, ref: g.grnNumber, status: 'RECEIVED', label: g.po.vendor.name, date: g.createdAt })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

    // Average PR-to-PO cycle time in days
    const avgCycleTimeDays = completedPOs.length > 0
      ? Math.round(
          completedPOs.reduce((s, po) => s + (po.updatedAt.getTime() - po.createdAt.getTime()), 0) /
          completedPOs.length / (86400 * 1000)
        )
      : null

    // Pipeline overview: ordered stages with counts
    const pipeline = [
      { stage: 'PR Draft', key: 'pr_draft', count: draftPRs, color: 'bg-gray-400', href: '/procurement/purchase-requests' },
      { stage: 'Awaiting Approval', key: 'pr_pending', count: pendingPRs + pendingApprovalPOs, color: 'bg-amber-500', href: '/procurement/approval-center' },
      { stage: 'Approved — No PO', key: 'pr_approved', count: approvedPRs, color: 'bg-blue-500', href: '/procurement/purchase-requests' },
      { stage: 'PO Pending Approval', key: 'po_pending', count: pendingApprovalPOs, color: 'bg-orange-500', href: '/procurement/purchase-orders' },
      { stage: 'PO Approved', key: 'po_approved', count: approvedPOs, color: 'bg-indigo-500', href: '/procurement/purchase-orders' },
      { stage: 'Awaiting GRN', key: 'awaiting_grn', count: pendingGRNs, color: 'bg-teal-500', href: '/procurement/goods-receipt' },
      { stage: 'Partially Received', key: 'partial_grn', count: partialGRNs, color: 'bg-violet-500', href: '/procurement/goods-receipt' },
      { stage: 'Unpaid Invoices', key: 'unpaid_inv', count: unpaidInvoices._count.id, color: 'bg-red-500', href: '/procurement/purchase-invoices' },
    ]

    return NextResponse.json(apiResponse({
      totalVendors, openPOs, openPRs, pendingGRNs, totalUnpaid, pendingApprovals,
      thisMonthSpend, recentPOs, pendingReturns, monthlySpend, topSuppliers, activities,
      // New fields
      pipeline,
      overdueInvoices: {
        count: overdueInvoices._count.id,
        total: Number(overdueInvoices._sum.totalAmount ?? 0),
      },
      overdueDeliveries,
      avgCycleTimeDays,
      fullyReceivedThisMonth: fullyReceivedPOs,
      funnel,
      supplierPerformance,
    }))
  } catch (e) {
    console.error('[procurement/dashboard]', (e as Error).message)
    return NextResponse.json(apiError('Failed'), { status: 500 })
  }
})
