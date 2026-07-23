import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const report = searchParams.get('report') ?? ''
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const date = searchParams.get('date')

  const dateFilter = (from && to)
    ? { gte: new Date(from), lte: new Date(to + 'T23:59:59Z') }
    : date
    ? { gte: new Date(date + 'T00:00:00Z'), lte: new Date(date + 'T23:59:59Z') }
    : undefined

  try {
    switch (report) {
      case 'fefo-expiry': {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() + 30)
        const batches = await prisma.inventoryBatch.findMany({
          where: {
            expiryDate: { lte: cutoff, gte: new Date() },
            quantityOnHand: { gt: 0 },
          },
          include: { _product: true } as any,
          orderBy: { expiryDate: 'asc' },
        })
        return NextResponse.json({ success: true, data: batches })
      }

      case 'low-stock': {
        const products = await prisma.product.findMany({
          where: { deletedAt: null },
          include: { _batches: true } as any,
        })
        const low = products
          .map((p: any) => ({
            ...p,
            totalQty: p._batches.reduce((s: number, b: any) => s + b.quantityOnHand, 0),
          }))
          .filter((p) => p.totalQty <= p.reorderLevel)
        return NextResponse.json({ success: true, data: low })
      }

      case 'grn-discrepancy': {
        const pos = await prisma.retailPurchaseOrder.findMany({
          where: { deletedAt: null, ...(dateFilter ? { orderDate: dateFilter } : {}) },
          include: { supplier: true, lineItems: { include: { product: true } }, grns: true },
        })
        const discrepancies = pos.flatMap((po) =>
          po.lineItems
            .filter((li) => li.quantityReceived !== li.quantityOrdered)
            .map((li) => ({
              poId: po.id,
              supplierName: po.supplier.companyName,
              productName: li.product.productName,
              ordered: li.quantityOrdered,
              received: li.quantityReceived,
              variance: li.quantityReceived - li.quantityOrdered,
            }))
        )
        return NextResponse.json({ success: true, data: discrepancies })
      }

      case 'daily-sales': {
        const orders = await (prisma as any)._retailSalesOrder.findMany({
          where: { ...(dateFilter ? { transactionDate: dateFilter } : {}) },
          include: { lineItems: true },
          orderBy: { transactionDate: 'asc' },
        })

        const byMethod: Record<string, { count: number; total: number }> = {}
        for (const order of orders) {
          const m = order.paymentMethod
          if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 }
          byMethod[m].count++
          byMethod[m].total += Number(order.grandTotalGbp)
        }

        const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.grandTotalGbp), 0)
        const totalVat = orders.reduce((s: number, o: any) => s + Number(o.vatAmountGbp), 0)
        const avgBasket = orders.length > 0
          ? orders.reduce((s: number, o: any) => s + o.lineItems.reduce((ls: number, li: any) => ls + li.quantity, 0), 0) / orders.length
          : 0

        return NextResponse.json({
          success: true,
          data: { orders: orders.length, totalRevenue, totalVat, avgBasket, byMethod },
        })
      }

      case 'supplier-performance': {
        const pos = await prisma.retailPurchaseOrder.findMany({
          where: { status: 'Received', deletedAt: null },
          include: { supplier: true, grns: true },
        })
        const rows = pos
          .filter((po) => po.grns.length > 0 && po.expectedDeliveryDate)
          .map((po) => {
            const firstGrn = po.grns[0]
            const expectedDays = po.expectedDeliveryDate!
            const actualDays = firstGrn.receivedDate
            const variance = Math.round(
              (new Date(actualDays).getTime() - new Date(expectedDays).getTime()) / (1000 * 60 * 60 * 24)
            )
            return {
              poId: po.id,
              supplierName: po.supplier.companyName,
              orderDate: po.orderDate,
              expectedDelivery: expectedDays,
              actualDelivery: actualDays,
              varianceDays: variance,
            }
          })
        return NextResponse.json({ success: true, data: rows })
      }

      case 'category-profitability': {
        const products = await (prisma.product.findMany as any)({
          where: { deletedAt: null },
          include: {
            _retailSalesLineItems: true,
            _batches: true,
          },
        })

        const byCat: Record<string, { revenue: number; cogs: number }> = {}
        for (const p of products) {
          const cat = p.category
          if (!byCat[cat]) byCat[cat] = { revenue: 0, cogs: 0 }
          for (const li of p._retailSalesLineItems) {
            byCat[cat].revenue += li.quantity * Number(li.unitPriceGbp) - Number(li.lineDiscountGbp)
          }
        }
        const rows = Object.entries(byCat).map(([category, data]) => ({
          category,
          revenue: data.revenue,
          grossProfit: data.revenue - data.cogs,
          margin: data.revenue > 0 ? ((data.revenue - data.cogs) / data.revenue) * 100 : 0,
        }))
        return NextResponse.json({ success: true, data: rows })
      }

      case 'customer-ltv': {
        const customers = await (prisma.retailCustomer.findMany as any)({
          where: { deletedAt: null },
          include: { _retailSalesOrders: true },
        })
        const rows = customers.map((c: any) => {
          const firstOrderDate = c._retailSalesOrders.length > 0
            ? c._retailSalesOrders.reduce((min: any, o: any) =>
                new Date(o.transactionDate) < new Date(min.transactionDate) ? o : min
              ).transactionDate
            : null
          const cohort = firstOrderDate
            ? `Q${Math.ceil((new Date(firstOrderDate).getMonth() + 1) / 3)} ${new Date(firstOrderDate).getFullYear()}`
            : 'No Orders'
          const ltv = c._retailSalesOrders.reduce((s: number, o: any) => s + Number(o.grandTotalGbp), 0)
          return {
            customerId: c.id,
            name: `${c.firstName} ${c.lastName}`,
            cohort,
            orderCount: c._retailSalesOrders.length,
            ltv,
            loyaltyPoints: c.loyaltyPointsBalance,
          }
        })
        return NextResponse.json({ success: true, data: rows })
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown report: ${report}` }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
