import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const dateFilter = {
    ...(from && { gte: new Date(from) }),
    ...(to && { lte: new Date(to) }),
  }

  const [accounts, lines] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    }),
    prisma.journalLine.findMany({
      where: {
        journal: {
          status: 'POSTED',
          ...(Object.keys(dateFilter).length && { date: dateFilter }),
        },
      },
      select: {
        debitAccountId: true,
        creditAccountId: true,
        debitAmount: true,
        creditAmount: true,
      },
    }),
  ])

  const balances: Record<string, { totalDebit: number; totalCredit: number }> = {}
  for (const line of lines) {
    if (line.debitAccountId) {
      balances[line.debitAccountId] ??= { totalDebit: 0, totalCredit: 0 }
      balances[line.debitAccountId].totalDebit += Number(line.debitAmount)
    }
    if (line.creditAccountId) {
      balances[line.creditAccountId] ??= { totalDebit: 0, totalCredit: 0 }
      balances[line.creditAccountId].totalCredit += Number(line.creditAmount)
    }
  }

  const rows = accounts
    .map((acc) => {
      const b = balances[acc.id] ?? { totalDebit: 0, totalCredit: 0 }
      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        totalDebit: Math.round(b.totalDebit * 100) / 100,
        totalCredit: Math.round(b.totalCredit * 100) / 100,
        balance: Math.round((b.totalDebit - b.totalCredit) * 100) / 100,
      }
    })
    .filter((r) => r.totalDebit !== 0 || r.totalCredit !== 0)

  const totals = rows.reduce(
    (acc, r) => ({ totalDebit: acc.totalDebit + r.totalDebit, totalCredit: acc.totalCredit + r.totalCredit }),
    { totalDebit: 0, totalCredit: 0 }
  )

  return NextResponse.json({ success: true, data: { rows, totals } })
})
