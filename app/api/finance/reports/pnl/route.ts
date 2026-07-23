import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  const to = searchParams.get('to') ?? new Date().toISOString().split('T')[0]
  const costCentreId = searchParams.get('costCentreId')

  const lines = await prisma.journalLine.findMany({
    where: {
      journal: { status: 'POSTED', date: { gte: new Date(from), lte: new Date(to) } },
      ...(costCentreId && { costCentreId }),
    },
    include: {
      debitAccount: { select: { id: true, code: true, name: true, type: true } },
      creditAccount: { select: { id: true, code: true, name: true, type: true } },
    },
  })

  const accountMap: Record<string, { id: string; code: string; name: string; type: string; net: number }> = {}

  for (const line of lines) {
    // Credit side — revenue accounts gain on credit
    if (line.creditAccount) {
      accountMap[line.creditAccount.id] ??= { ...line.creditAccount, net: 0 }
      accountMap[line.creditAccount.id].net += Number(line.creditAmount) - Number(line.debitAmount)
    }
    // Debit side — expense accounts gain on debit
    if (line.debitAccount) {
      accountMap[line.debitAccount.id] ??= { ...line.debitAccount, net: 0 }
      accountMap[line.debitAccount.id].net += Number(line.debitAmount) - Number(line.creditAmount)
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100

  const revenueAccounts = Object.values(accountMap)
    .filter((a) => a.type === 'REVENUE')
    .map((a) => ({ ...a, net: r2(a.net) }))
    .sort((a, b) => a.code.localeCompare(b.code))

  const expenseAccounts = Object.values(accountMap)
    .filter((a) => a.type === 'EXPENSE')
    .map((a) => ({ ...a, net: r2(a.net) }))
    .sort((a, b) => a.code.localeCompare(b.code))

  const totalRevenue = r2(revenueAccounts.reduce((s, a) => s + a.net, 0))
  const totalExpenses = r2(expenseAccounts.reduce((s, a) => s + a.net, 0))
  const netProfit = r2(totalRevenue - totalExpenses)

  return NextResponse.json({
    success: true,
    data: { from, to, revenueAccounts, expenseAccounts, totalRevenue, totalExpenses, netProfit },
  })
})
