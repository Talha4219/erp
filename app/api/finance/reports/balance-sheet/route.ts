import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const asOf = searchParams.get('asOf') ?? new Date().toISOString().split('T')[0]

  const lines = await prisma.journalLine.findMany({
    where: { journal: { status: 'POSTED', date: { lte: new Date(asOf) } } },
    include: {
      debitAccount: { select: { id: true, code: true, name: true, type: true } },
      creditAccount: { select: { id: true, code: true, name: true, type: true } },
    },
  })

  const balances: Record<string, { id: string; code: string; name: string; type: string; debit: number; credit: number }> = {}

  for (const line of lines) {
    if (line.debitAccount) {
      balances[line.debitAccount.id] ??= { ...line.debitAccount, debit: 0, credit: 0 }
      balances[line.debitAccount.id].debit += Number(line.debitAmount)
      balances[line.debitAccount.id].credit += Number(line.creditAmount)
    }
    if (line.creditAccount) {
      balances[line.creditAccount.id] ??= { ...line.creditAccount, debit: 0, credit: 0 }
      balances[line.creditAccount.id].credit += Number(line.creditAmount)
      balances[line.creditAccount.id].debit += Number(line.debitAmount)
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100

  // Assets: normal debit balance
  const assetAccounts = Object.values(balances)
    .filter((a) => a.type === 'ASSET')
    .map((a) => ({ ...a, balance: r2(a.debit - a.credit) }))
    .sort((a, b) => a.code.localeCompare(b.code))

  // Liabilities: normal credit balance
  const liabilityAccounts = Object.values(balances)
    .filter((a) => a.type === 'LIABILITY')
    .map((a) => ({ ...a, balance: r2(a.credit - a.debit) }))
    .sort((a, b) => a.code.localeCompare(b.code))

  // Equity: normal credit balance
  const equityAccounts = Object.values(balances)
    .filter((a) => a.type === 'EQUITY')
    .map((a) => ({ ...a, balance: r2(a.credit - a.debit) }))
    .sort((a, b) => a.code.localeCompare(b.code))

  // Retained earnings = Revenue - Expenses (cumulative through asOf)
  const rnAccounts = Object.values(balances).filter((a) => a.type === 'REVENUE' || a.type === 'EXPENSE')
  const retainedEarnings = r2(
    rnAccounts.reduce((s, a) => {
      if (a.type === 'REVENUE') return s + (a.credit - a.debit)
      return s - (a.debit - a.credit)
    }, 0)
  )

  const totalAssets = r2(assetAccounts.reduce((s, a) => s + a.balance, 0))
  const totalLiabilities = r2(liabilityAccounts.reduce((s, a) => s + a.balance, 0))
  const totalEquity = r2(equityAccounts.reduce((s, a) => s + a.balance, 0) + retainedEarnings)

  return NextResponse.json({
    success: true,
    data: {
      asOf,
      assetAccounts,
      liabilityAccounts,
      equityAccounts,
      retainedEarnings,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.02,
    },
  })
})
