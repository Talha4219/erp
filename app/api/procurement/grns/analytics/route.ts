import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiErrorSafe } from '@/lib/utils'
import { getUserCompanyId, companyScope } from '@/lib/company-scope'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id!)

  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const scope = companyScope(companyId)

    const [grns, pendingGRNs, poStatusCounts] = await Promise.all([
      prisma.goodsReceiptNote.findMany({
        where: scope,
        include: {
          lineItems: { select: { acceptedQty: true, rejectedQty: true, unitPrice: true } },
          po: { select: { vendor: { select: { name: true } } } },
        },
        orderBy: { receivedDate: 'desc' },
      }),
      prisma.purchaseOrder.count({
        where: { ...scope, status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] }, deletedAt: null },
      }),
      prisma.purchaseOrder.groupBy({
        by: ['status'],
        where: { ...scope, deletedAt: null },
        _count: { id: true },
      }),
    ])

    // KPIs
    const todayCount = grns.filter(g => new Date(g.receivedDate) >= todayStart).length
    let totalAccepted = 0, totalRejected = 0, receivingValue = 0
    grns.forEach(g => g.lineItems.forEach(li => {
      totalAccepted  += Number(li.acceptedQty)
      totalRejected  += Number(li.rejectedQty)
      receivingValue += Number(li.acceptedQty) * Number(li.unitPrice)
    }))

    // Daily trend — last 7 days
    const dailyMap: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 86_400_000)
      dailyMap[d.toISOString().split('T')[0]] = 0
    }
    grns.forEach(g => {
      const day = new Date(g.receivedDate).toISOString().split('T')[0]
      if (day in dailyMap) {
        dailyMap[day] += g.lineItems.reduce((s, li) => s + Number(li.acceptedQty) * Number(li.unitPrice), 0)
      }
    })
    const dailyTrend = Object.entries(dailyMap).map(([date, value]) => ({
      day: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' }),
      date,
      value,
    }))

    // PO receipt status distribution
    const statusMap = Object.fromEntries(poStatusCounts.map(r => [r.status, r._count.id]))
    const statusDist = [
      { label: 'Completed', count: statusMap['FULLY_RECEIVED']     ?? 0, cls: 'bg-emerald-500' },
      { label: 'Pending',   count: statusMap['APPROVED']           ?? 0, cls: 'bg-amber-400'   },
      { label: 'Partial',   count: statusMap['PARTIALLY_RECEIVED'] ?? 0, cls: 'bg-blue-500'    },
      { label: 'Cancelled', count: statusMap['CANCELLED']          ?? 0, cls: 'bg-red-400'     },
    ]

    // Supplier quality
    const supplierMap: Record<string, { name: string; accepted: number; rejected: number }> = {}
    grns.forEach(g => {
      const name = g.po.vendor.name
      if (!supplierMap[name]) supplierMap[name] = { name, accepted: 0, rejected: 0 }
      g.lineItems.forEach(li => {
        supplierMap[name].accepted += Number(li.acceptedQty)
        supplierMap[name].rejected += Number(li.rejectedQty)
      })
    })
    const supplierQuality = Object.values(supplierMap)
      .filter(s => s.accepted + s.rejected > 0)
      .sort((a, b) => (b.accepted + b.rejected) - (a.accepted + a.rejected))
      .slice(0, 5)

    return NextResponse.json(apiResponse({
      kpis: { todayCount, totalItemsReceived: totalAccepted, pendingGRNs, rejectedItems: totalRejected, receivingValue },
      dailyTrend,
      statusDist,
      supplierQuality,
    }))
  } catch (err) {
    return NextResponse.json(apiErrorSafe(err, 'An unexpected error occurred'), { status: 500 })
  }
})
