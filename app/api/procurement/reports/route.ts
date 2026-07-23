import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const [
      topSuppliersBySpend,
      poStatusBreakdown,
      monthlySpend,
      supplierAvgRatings,
      invoicePaymentStats,
    ] = await Promise.all([
      // Top 10 suppliers by total PO value
      prisma.purchaseOrder.groupBy({
        by: ['vendorId'],
        where: { deletedAt: null, status: { not: 'CANCELLED' } },
        _sum: { grandTotal: true },
        _count: { id: true },
        orderBy: { _sum: { grandTotal: 'desc' } },
        take: 10,
      }).then(async rows => {
        const vendorIds = rows.map(r => r.vendorId)
        const vendors = await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true, vendorCode: true } })
        const map = Object.fromEntries(vendors.map(v => [v.id, v]))
        return rows.map(r => ({ vendor: map[r.vendorId] ?? { id: r.vendorId, name: 'Unknown', vendorCode: '' }, totalSpend: Number(r._sum.grandTotal ?? 0), poCount: r._count.id }))
      }),

      // PO status breakdown
      prisma.purchaseOrder.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true },
      }).then(rows => rows.map(r => ({ status: r.status, count: r._count.id }))),

      // Monthly PO spend for last 6 months
      prisma.purchaseOrder.findMany({
        where: { deletedAt: null, status: { not: 'CANCELLED' }, orderDate: { gte: sixMonthsAgo } },
        select: { orderDate: true, grandTotal: true },
      }).then(orders => {
        const byMonth: Record<string, number> = {}
        for (const o of orders) {
          const key = `${o.orderDate.getFullYear()}-${String(o.orderDate.getMonth() + 1).padStart(2, '0')}`
          byMonth[key] = (byMonth[key] ?? 0) + Number(o.grandTotal)
        }
        return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }))
      }),

      // Average ratings per vendor
      prisma.supplierRating.groupBy({
        by: ['vendorId'],
        _avg: { overallScore: true, qualityScore: true, deliveryScore: true, priceScore: true },
        _count: { id: true },
        orderBy: { _avg: { overallScore: 'desc' } },
        take: 10,
      }).then(async rows => {
        const vendorIds = rows.map(r => r.vendorId)
        const vendors = await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } })
        const map = Object.fromEntries(vendors.map(v => [v.id, v]))
        return rows.map(r => ({
          vendor: map[r.vendorId] ?? { id: r.vendorId, name: 'Unknown' },
          avgOverall: Number((r._avg.overallScore ?? 0).toFixed(1)),
          avgQuality: Number((r._avg.qualityScore ?? 0).toFixed(1)),
          avgDelivery: Number((r._avg.deliveryScore ?? 0).toFixed(1)),
          avgPrice: Number((r._avg.priceScore ?? 0).toFixed(1)),
          ratingCount: r._count.id,
        }))
      }),

      // Invoice payment performance
      prisma.vendorInvoice.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _sum: { totalAmount: true, paidAmount: true },
        _count: { id: true },
      }).then(rows => rows.map(r => ({ status: r.status, count: r._count.id, total: Number(r._sum.totalAmount ?? 0), paid: Number(r._sum.paidAmount ?? 0) }))),
    ])

    return NextResponse.json(apiResponse({ topSuppliersBySpend, poStatusBreakdown, monthlySpend, supplierAvgRatings, invoicePaymentStats }))
  } catch (e) {
    console.error('[procurement/reports]', (e as Error).message)
    return NextResponse.json(apiError('Failed'), { status: 500 })
  }
})
