import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModuleAccess } from '@/lib/authz'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'reports')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'sales'
  const startDate = searchParams.get('from')
  const endDate = searchParams.get('to')
  const month = searchParams.get('month')
  const year = searchParams.get('year')

  try {
    if (type === 'sales') {
      const data = await prisma.customerInvoice.findMany({
        include: { customer: true },
        where: {
          deletedAt: null,
          ...(startDate && endDate
            ? { invoiceDate: { gte: new Date(startDate), lte: new Date(endDate) } }
            : {}),
        },
        orderBy: { invoiceDate: 'desc' },
        take: 500,
      })
      return NextResponse.json({ success: true, data })
    }

    if (type === 'purchase') {
      const data = await prisma.purchaseOrder.findMany({
        include: { vendor: true },
        where: {
          deletedAt: null,
          ...(startDate && endDate
            ? { orderDate: { gte: new Date(startDate), lte: new Date(endDate) } }
            : {}),
        },
        orderBy: { orderDate: 'desc' },
        take: 500,
      })
      return NextResponse.json({ success: true, data })
    }

    if (type === 'inventory') {
      const data = await prisma.stockLedger.findMany({
        include: { item: true, warehouse: true },
        orderBy: { transactionDate: 'desc' },
        take: 500,
      })
      return NextResponse.json({ success: true, data })
    }

    if (type === 'payroll') {
      const data = await prisma.payroll.findMany({
        include: { employee: true },
        where: {
          ...(month ? { month: parseInt(month) } : {}),
          ...(year ? { year: parseInt(year) } : {}),
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 500,
      })
      return NextResponse.json({ success: true, data })
    }

    if (type === 'trial-balance') {
      const data = await prisma.account.findMany({
        where: { isActive: true },
        include: {
          debitLines: { select: { debitAmount: true } },
          creditLines: { select: { creditAmount: true } },
        },
        orderBy: { code: 'asc' },
        take: 500,
      })
      const mapped = data.map((acc) => ({
        ...acc,
        totalDebit: acc.debitLines.reduce((s: number, l: any) => s + Number(l.debitAmount), 0),
        totalCredit: acc.creditLines.reduce((s: number, l: any) => s + Number(l.creditAmount), 0),
      }))
      return NextResponse.json({ success: true, data: mapped })
    }

    if (type === 'receivables-aging') {
      const today = new Date()
      const data = await prisma.customerInvoice.findMany({
        where: { status: { not: 'PAID' }, deletedAt: null },
        include: { customer: true },
        orderBy: { dueDate: 'asc' },
        take: 500,
      })
      const aging = data.map((inv) => {
        const daysDue = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        let bucket = 'Current'
        if (daysDue > 0 && daysDue <= 30) bucket = '1-30 days'
        else if (daysDue > 30 && daysDue <= 60) bucket = '31-60 days'
        else if (daysDue > 60 && daysDue <= 90) bucket = '61-90 days'
        else if (daysDue > 90) bucket = '90+ days'
        return { ...inv, daysDue, bucket }
      })
      return NextResponse.json({ success: true, data: aging })
    }

    if (type === 'yearly-expenses') {
      const targetYear = year ? parseInt(year) : new Date().getFullYear()
      const start = new Date(`${targetYear}-01-01T00:00:00Z`)
      const end = new Date(`${targetYear}-12-31T23:59:59Z`)

      const [expenses, sales] = await Promise.all([
        prisma.expense.findMany({
          where: { deletedAt: null, expenseDate: { gte: start, lte: end } },
          include: { category: { select: { categoryName: true } } },
          take: 500,
        }),
        prisma.salesOrderV2.findMany({
          where: { channel: 'POS', orderDate: { gte: start, lte: end } },
          select: { orderDate: true, totalAmount: true },
          take: 500,
        }),
      ])

      const monthData: Array<{ month: number; label: string; revenue: number; expenses: number; profit: number; breakdown: Record<string, number> }> = []
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

      for (let m = 1; m <= 12; m++) {
        const monthExpenses = expenses.filter((e: any) => new Date(e.expenseDate).getMonth() + 1 === m)
        const monthSales = sales.filter((s: any) => new Date(s.orderDate).getMonth() + 1 === m)
        const totalExpenses = monthExpenses.reduce((s: number, e: any) => s + Number(e.amountGbp), 0)
        const totalRevenue = monthSales.reduce((s: number, sale: any) => s + Number(sale.totalAmount), 0)
        const breakdown: Record<string, number> = {}
        for (const e of monthExpenses) {
          const cat = e.category.categoryName
          breakdown[cat] = (breakdown[cat] ?? 0) + Number(e.amountGbp)
        }
        monthData.push({ month: m, label: MONTHS[m - 1], revenue: totalRevenue, expenses: totalExpenses, profit: totalRevenue - totalExpenses, breakdown })
      }

      return NextResponse.json({ success: true, data: monthData })
    }

    return NextResponse.json({ success: false, error: 'Unknown report type' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
