import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async () => {
  try {
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())

    const mtdStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const sameWeekdayLastYear = new Date(todayStart)
    sameWeekdayLastYear.setFullYear(sameWeekdayLastYear.getFullYear() - 1)
    const sameWeekdayLastYearEnd = new Date(sameWeekdayLastYear.getTime() + 24 * 60 * 60 * 1000 - 1)

    const [todaySales, lastYearSameDay, weeklySales, mtdSales, todayExpenses, wasteToday, lowStockCount, expiryAlerts, mtdCogsRows] =
      await Promise.all([
        (prisma as any)._retailSalesOrder.aggregate({
          where: { transactionDate: { gte: todayStart, lte: todayEnd } },
          _sum: { grandTotalGbp: true, vatAmountGbp: true, netTotalGbp: true },
          _count: true,
        }),
        (prisma as any)._retailSalesOrder.aggregate({
          where: { transactionDate: { gte: sameWeekdayLastYear, lte: sameWeekdayLastYearEnd } },
          _sum: { grandTotalGbp: true },
        }),
        (prisma as any)._retailSalesOrder.aggregate({
          where: { transactionDate: { gte: weekStart, lte: todayEnd } },
          _sum: { grandTotalGbp: true, netTotalGbp: true },
        }),
        (prisma as any)._retailSalesOrder.aggregate({
          where: { transactionDate: { gte: mtdStart, lte: todayEnd } },
          _sum: { grandTotalGbp: true, netTotalGbp: true },
        }),
        prisma.expense.aggregate({
          where: { deletedAt: null, expenseDate: { gte: todayStart, lte: todayEnd } },
          _sum: { amountGbp: true },
        }),
        prisma.stockAdjustment.findMany({
          where: { reason: 'Expired', adjustedAt: { gte: todayStart, lte: todayEnd } },
          include: { batch: { include: { _product: true } as any } },
        }),
        prisma.product.count({
          where: {
            deletedAt: null,
            batches: { none: { quantityOnHand: { gt: 0 } } },
          } as any,
        }),
        prisma.inventoryBatch.count({
          where: {
            quantityOnHand: { gt: 0 },
            expiryDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        // MTD cost of goods sold from the inventory ledger (sales minus restocked returns)
        prisma.$queryRaw<Array<{ cogs: number }>>`
          SELECT COALESCE(SUM(CASE WHEN "referenceType" = 'POS' THEN "totalCost" ELSE -"totalCost" END), 0)::float AS cogs
          FROM "StockLedger"
          WHERE "referenceType" IN ('POS', 'POS_RETURN') AND "transactionDate" >= ${mtdStart}
        `,
      ])

    const todaySalesTotal = Number(todaySales._sum.grandTotalGbp ?? 0)
    const lastYearTotal = Number(lastYearSameDay._sum.grandTotalGbp ?? 0)
    const salesVariancePct = lastYearTotal > 0
      ? ((todaySalesTotal - lastYearTotal) / lastYearTotal) * 100
      : 0

    const mtdRevenue = Number(mtdSales._sum.grandTotalGbp ?? 0)
    const mtdNet = Number(mtdSales._sum.netTotalGbp ?? 0)
    // True gross profit: net revenue (ex VAT) minus cost of goods sold
    const mtdCogs = mtdCogsRows[0]?.cogs ?? 0
    const grossProfitMtd = mtdNet - mtdCogs
    const grossProfitMtdPct = mtdNet > 0 ? (grossProfitMtd / mtdNet) * 100 : 0

    const todayTransactions = todaySales._count
    const avgTransactionValue = todayTransactions > 0 ? todaySalesTotal / todayTransactions : 0

    const todayExpensesTotal = Number(todayExpenses._sum.amountGbp ?? 0)
    const wageCostRatio = todaySalesTotal > 0 ? (todayExpensesTotal / todaySalesTotal) * 100 : 0

      const wasteValue = wasteToday.reduce((sum: number, adj: any) => {
        return sum + Math.abs(adj.quantityChange) * Number(adj.batch._product?.sellingPriceGbp ?? 0)
      }, 0)

    return NextResponse.json({
      success: true,
      data: {
        todaySales: todaySalesTotal,
        lastYearSameDay: lastYearTotal,
        salesVariancePct,
        weekSales: Number(weeklySales._sum.grandTotalGbp ?? 0),
        mtdSales: mtdRevenue,
        mtdNetSales: mtdNet,
        mtdCogs,
        grossProfitMtd,
        grossProfitMtdPct,
        todayTransactionCount: todayTransactions,
        avgTransactionValue,
        wageCostRatio,
        wasteValueToday: wasteValue,
        lowStockCount,
        expiryAlerts7Day: expiryAlerts,
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
