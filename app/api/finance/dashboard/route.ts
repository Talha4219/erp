import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const [bankAccounts, journals, invoices, bills] = await Promise.all([
      prisma.bankAccount.findMany({ orderBy: { currentBalance: 'desc' } }),
      prisma.journalEntry.findMany({
        where: { date: { gte: sixMonthsAgo }, deletedAt: null },
        orderBy: { date: 'desc' },
        take: 5,
        select: { id: true, entryNumber: true, description: true, date: true, status: true },
      }),
      prisma.customerInvoice.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: { totalAmount: true, paidAmount: true, status: true, dueDate: true, invoiceDate: true },
      }),
      prisma.vendorInvoice.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: { totalAmount: true, paidAmount: true, status: true, dueDate: true },
      }),
    ])

    const cashBalance = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0)

    const arOutstanding = invoices
      .filter(i => i.status !== 'PAID')
      .reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount ?? 0)), 0)

    const apOutstanding = bills
      .filter(b => b.status !== 'PAID')
      .reduce((s, b) => s + (Number(b.totalAmount) - Number(b.paidAmount ?? 0)), 0)

    const mtdInvoices = invoices.filter(i => i.invoiceDate && new Date(i.invoiceDate) >= startOfMonth)
    const revenueThisMonth = mtdInvoices.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0)

    // AR aging
    const today = new Date()
    const arAging = { current: 0, days30: 0, days60: 0, days90plus: 0 }
    for (const inv of invoices.filter(i => i.status !== 'PAID')) {
      const due = new Date(inv.dueDate)
      const diff = Math.floor((today.getTime() - due.getTime()) / 86400000)
      const amt = Number(inv.totalAmount) - Number(inv.paidAmount ?? 0)
      if (diff <= 0) arAging.current += amt
      else if (diff <= 30) arAging.days30 += amt
      else if (diff <= 60) arAging.days60 += amt
      else arAging.days90plus += amt
    }

    // Monthly P&L - simplified from journal entries
    const monthlyPnL: Array<{ month: string; revenue: number; expenses: number; profit: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
      const monthInvoices = invoices.filter(inv => {
        const issued = inv.invoiceDate ? new Date(inv.invoiceDate) : null
        return issued && issued.getFullYear() === d.getFullYear() && issued.getMonth() === d.getMonth()
      })
      const revenue = monthInvoices.reduce((s, inv) => s + Number(inv.paidAmount ?? 0), 0)
      const expenses = 0 // simplified
      monthlyPnL.push({ month: label, revenue, expenses, profit: revenue - expenses })
    }

    const expensesThisMonth = 0
    const netProfitMtd = revenueThisMonth - expensesThisMonth

    return NextResponse.json({
      success: true,
      data: {
        cashBalance,
        arOutstanding,
        apOutstanding,
        revenueThisMonth,
        expensesThisMonth,
        netProfitMtd,
        bankAccounts: bankAccounts.map(a => ({
          id: a.id,
          accountName: a.accountName,
          accountType: a.accountType,
          currentBalance: Number(a.currentBalance),
          currency: a.currency,
        })),
        monthlyPnL,
        arAging,
        recentJournals: journals.map(j => ({
          ...j,
          totalDebit: 0,
          date: j.date.toISOString(),
        })),
        expenseBreakdown: [],
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
