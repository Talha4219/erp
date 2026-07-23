import prisma from '@/lib/prisma'
import { nextDocNumber } from '@/lib/services/numbering'

const r2 = (n: number) => Math.round(n * 100) / 100

// ── Accounts ────────────────────────────────────────────────────────────

export function listAccounts() {
  return prisma.account.findMany({
    where: { isActive: true },
    include: { parent: true, children: true, _count: { select: { debitLines: true, creditLines: true } } },
    orderBy: { code: 'asc' },
  })
}

export function createAccount(data: Record<string, unknown>) {
  return prisma.account.create({ data: data as any })
}

// ── Bank Accounts ───────────────────────────────────────────────────────

export function listBankAccounts(companyId: string) {
  return prisma.bankAccount.findMany({
    where: { isActive: true, companyId },
    include: { _count: { select: { statements: true, transactions: true } } },
    take: 100,
  })
}

export function createBankAccount(data: { accountName: string; accountNumber: string; sortCode?: string; iban?: string; bankName: string; currency?: string; accountType?: string; glAccountCode?: string; openingBalance?: number; companyId: string }) {
  return prisma.bankAccount.create({
    data: { ...data, currentBalance: data.openingBalance ?? 0 } as any,
  })
}

// ── Bank Statements ─────────────────────────────────────────────────────

export function listBankStatements(bankAccountId?: string | null) {
  return prisma.bankStatement.findMany({
    where: { ...(bankAccountId && { bankAccountId }) },
    include: { bankAccount: { select: { accountName: true, currency: true } }, _count: { select: { lines: true } } },
    orderBy: { statementDate: 'desc' }, take: 100,
  })
}

export function createBankStatement(data: { bankAccountId: string; statementDate: string; openingBalance: number; closingBalance: number; lines: { transactionDate: string; description: string; amount: number; isCredit: boolean; reference?: string }[] }) {
  return prisma.bankStatement.create({
    data: {
      bankAccountId: data.bankAccountId, statementDate: new Date(data.statementDate),
      openingBalance: data.openingBalance, closingBalance: data.closingBalance,
      lines: { create: data.lines.map(l => ({ transactionDate: new Date(l.transactionDate), description: l.description, amount: Math.abs(l.amount), isCredit: l.isCredit, reference: l.reference })) },
    },
    include: { lines: { orderBy: { transactionDate: 'asc' } } },
  })
}

export function getBankStatement(id: string) {
  return prisma.bankStatement.findUnique({
    where: { id }, include: { bankAccount: true, lines: { orderBy: { transactionDate: 'asc' } } },
  })
}

export async function autoMatchBankStatement(id: string, body?: { lineId?: string; matchedPaymentId?: string; matchedJournalId?: string }) {
  if (body?.lineId) {
    const updateData: Record<string, unknown> = { isMatched: true }
    if (body.matchedPaymentId) updateData.matchedPaymentId = body.matchedPaymentId
    if (body.matchedJournalId) updateData.matchedJournalId = body.matchedJournalId
    await prisma.bankStatementLine.update({ where: { id: body.lineId }, data: updateData as any })
  } else {
    const statement = await prisma.bankStatement.findUnique({
      where: { id }, include: { lines: { where: { isMatched: false }, orderBy: { transactionDate: 'asc' } } },
    })
    if (!statement) throw new Error('Statement not found')
    for (const line of statement.lines) {
      const amt = Number(line.amount)
      const windowStart = new Date(line.transactionDate.getTime() - 3 * 86400000)
      const windowEnd = new Date(line.transactionDate.getTime() + 3 * 86400000)
      if (line.isCredit) {
        const payment = await prisma.customerPayment.findFirst({
          where: { paymentDate: { gte: windowStart, lte: windowEnd }, amount: amt },
        })
        if (payment) {
          await prisma.bankStatementLine.update({ where: { id: line.id }, data: { isMatched: true, matchedPaymentId: payment.id } })
        }
      } else {
        const payment = await prisma.vendorPayment.findFirst({
          where: { paymentDate: { gte: windowStart, lte: windowEnd }, amount: amt },
        })
        if (payment) {
          await prisma.bankStatementLine.update({ where: { id: line.id }, data: { isMatched: true, matchedPaymentId: payment.id } })
        }
      }
    }
  }
  const remaining = await prisma.bankStatementLine.count({ where: { statementId: id, isMatched: false } })
  if (remaining === 0) {
    await prisma.bankStatement.update({ where: { id }, data: { isReconciled: true } })
  }
  return { isReconciled: remaining === 0 }
}

export async function unmatchBankStatementLine(id: string, lineId: string) {
  await prisma.bankStatementLine.update({ where: { id: lineId, statementId: id }, data: { isMatched: false, matchedPaymentId: null, matchedJournalId: null } })
  await prisma.bankStatement.update({ where: { id }, data: { isReconciled: false } })
}

// ── Budgets ─────────────────────────────────────────────────────────────

export function listBudgets(year?: string | null) {
  return prisma.budget.findMany({
    where: { ...(year && { fiscalYear: parseInt(year) }) },
    include: { account: true, costCentre: true, lines: { orderBy: { month: 'asc' } } },
    orderBy: [{ fiscalYear: 'desc' }, { account: { code: 'asc' } }],
  })
}

export function createBudget(data: Record<string, unknown>) {
  const { lines, ...rest } = data
  return prisma.budget.create({ data: { ...(rest as any), lines: { create: lines as any[] ?? [] } } as any, include: { account: true, costCentre: true, lines: { orderBy: { month: 'asc' } } } })
}

export async function updateBudget(id: string, data: Record<string, unknown>) {
  return prisma.$transaction(async (tx) => {
    if (data.lines) await tx.budgetLine.deleteMany({ where: { budgetId: id } })
    const { lines: _lines, ...rest } = data
    return tx.budget.update({ where: { id }, data: { ...(rest as any), lines: _lines ? { create: _lines as any[] } : undefined } as any, include: { account: true, costCentre: true, lines: { orderBy: { month: 'asc' } } } })
  })
}

export function deleteBudget(id: string) {
  return prisma.budget.delete({ where: { id } })
}

// ── Cost Centres ────────────────────────────────────────────────────────

export function listCostCentres() {
  return prisma.costCentre.findMany({ orderBy: { code: 'asc' } })
}

export function createCostCentre(data: Record<string, unknown>) {
  return prisma.costCentre.create({ data: data as any })
}

export function updateCostCentre(id: string, data: Record<string, unknown>) {
  return prisma.costCentre.update({ where: { id }, data: data as any })
}

export function deleteCostCentre(id: string) {
  return prisma.costCentre.delete({ where: { id } })
}

// ── Currencies ──────────────────────────────────────────────────────────

export function listCurrencies() {
  return prisma.currency.findMany({ orderBy: { code: 'asc' } })
}

export function createCurrency(data: Record<string, unknown>) {
  return prisma.currency.create({ data: data as any })
}

export function updateCurrency(id: string, data: Record<string, unknown>) {
  return prisma.currency.update({ where: { id }, data: data as any })
}

export function deleteCurrency(id: string) {
  return prisma.currency.delete({ where: { id } })
}

// ── Dashboard ────────────────────────────────────────────────────────────

export async function getFinanceDashboard() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [bankAccounts, arInvoices, apInvoices, monthlyInvoices, journals, fiscalYear] = await Promise.all([
    prisma.bankAccount.findMany({ where: { isActive: true }, select: { accountName: true, currentBalance: true, currency: true } }),
    prisma.customerInvoice.findMany({ where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] } }, select: { totalAmount: true, paidAmount: true } }),
    prisma.vendorInvoice.findMany({ where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] } }, select: { totalAmount: true, paidAmount: true } }),
    prisma.customerInvoice.findMany({ where: { deletedAt: null, invoiceDate: { gte: startOfMonth, lte: endOfMonth }, status: 'PAID' }, select: { paidAmount: true } }),
    prisma.journalEntry.findMany({ where: { status: 'POSTED' }, include: { lines: true }, orderBy: { date: 'desc' }, take: 5 }),
    prisma.fiscalYear.findFirst({ where: { isCurrent: true }, select: { id: true, name: true, startDate: true, endDate: true } }),
  ])

  const cashBalance = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0)
  const arOutstanding = arInvoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount ?? 0), 0)
  const apOutstanding = apInvoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount ?? 0), 0)
  const revenueThisMonth = monthlyInvoices.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0)

  // AR Aging
  const arAgingInvoices = await prisma.customerInvoice.findMany({
    where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] } },
    select: { id: true, invoiceNumber: true, customer: { select: { name: true } }, totalAmount: true, paidAmount: true, invoiceDate: true, dueDate: true },
  })
  const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
  for (const inv of arAgingInvoices) {
    const outstanding = r2(Number(inv.totalAmount) - Number(inv.paidAmount ?? 0))
    if (outstanding <= 0) continue
    const due = inv.dueDate ? Math.max(0, Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000)) : 0
    if (due <= 0) buckets.current += outstanding
    else if (due <= 30) buckets['1-30'] += outstanding
    else if (due <= 60) buckets['31-60'] += outstanding
    else if (due <= 90) buckets['61-90'] += outstanding
    else buckets['90+'] += outstanding
  }

  // Monthly P&L for last 6 months
  const monthlyPnL: { month: string; revenue: number; expenses: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const lines = await prisma.journalLine.findMany({
      where: { journal: { status: 'POSTED', date: { gte: mStart, lte: mEnd } } },
      include: { debitAccount: { select: { type: true } }, creditAccount: { select: { type: true } } },
    })
    let revenue = 0, expenses = 0
    for (const line of lines) {
      if (line.debitAccount?.type === 'EXPENSE') expenses += Number(line.debitAmount) - Number(line.creditAmount)
      if (line.creditAccount?.type === 'REVENUE') revenue += Number(line.creditAmount) - Number(line.debitAmount)
    }
    monthlyPnL.push({ month: d.toLocaleString('en-GB', { month: 'short', year: '2-digit' }), revenue: r2(revenue), expenses: r2(expenses) })
  }

  return {
    cashBalance: r2(cashBalance), arOutstanding: r2(arOutstanding), apOutstanding: r2(apOutstanding),
    revenueThisMonth: r2(revenueThisMonth), arAging: buckets,
    monthlyPnL, bankAccountBalances: bankAccounts,
    recentJournals: journals.map(j => ({ ...j, totalDebit: 0 })), currentFiscalYear: fiscalYear,
    expenseBreakdown: [] as { category: string; amount: number }[],
  }
}

// ── Fiscal Years ────────────────────────────────────────────────────────

export function listFiscalYears() {
  return prisma.fiscalYear.findMany({ include: { _count: { select: { periods: true } } }, orderBy: { startDate: 'desc' } })
}

export async function createFiscalYear(data: { name: string; startDate: string; endDate: string; isCurrent?: boolean }) {
  return prisma.$transaction(async (tx) => {
    if (data.isCurrent) await tx.fiscalYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } })
    return tx.fiscalYear.create({ data: { name: data.name, startDate: new Date(data.startDate), endDate: new Date(data.endDate), isCurrent: data.isCurrent ?? false } })
  })
}

export async function updateFiscalYear(id: string, data: { name?: string; startDate?: string; endDate?: string; isCurrent?: boolean; isClosed?: boolean; closedById?: string }) {
  return prisma.$transaction(async (tx) => {
    if (typeof data.isCurrent === 'boolean' && data.isCurrent) {
      await tx.fiscalYear.updateMany({ where: { isCurrent: true, id: { not: id } }, data: { isCurrent: false } })
    }
    const updateData: Record<string, unknown> = {}
    if (data.name) updateData.name = data.name
    if (data.startDate) updateData.startDate = new Date(data.startDate)
    if (data.endDate) updateData.endDate = new Date(data.endDate)
    if (typeof data.isCurrent === 'boolean') updateData.isCurrent = data.isCurrent
    if (data.isClosed) { updateData.isClosed = true; updateData.closedAt = new Date(); updateData.closedById = data.closedById }
    return tx.fiscalYear.update({ where: { id }, data: updateData })
  })
}

// ── Fixed Assets ────────────────────────────────────────────────────────

export function listFixedAssets(status?: string | null) {
  return prisma.fixedAsset.findMany({
    where: { ...(status && { status: status as any }) },
    include: { account: true, depreciations: { orderBy: { period: 'desc' }, take: 1 } },
    orderBy: { assetCode: 'asc' },
  })
}

export async function createFixedAsset(data: Record<string, unknown>) {
  const count = await prisma.fixedAsset.count()
  return prisma.fixedAsset.create({
    data: { assetCode: `FA-${count + 1}`, ...data, purchaseDate: data.purchaseDate ? new Date(data.purchaseDate as string) : undefined, bookValue: (data.purchaseCost as number) ?? 0 } as any,
  })
}

export function getFixedAsset(id: string) {
  return prisma.fixedAsset.findUnique({
    where: { id }, include: { account: true, depreciations: { orderBy: { period: 'asc' } } },
  })
}

export function updateFixedAsset(id: string, data: Record<string, unknown>) {
  return prisma.fixedAsset.update({ where: { id }, data: data as any })
}

export function deleteFixedAsset(id: string) {
  return prisma.fixedAsset.delete({ where: { id } })
}

export async function depreciateFixedAsset(id: string, period: string) {
  const asset = await prisma.fixedAsset.findUnique({ where: { id } })
  if (!asset) throw new Error('Asset not found')
  if (asset.status !== 'ACTIVE') throw new Error('Asset is not active')

  const existing = await prisma.assetDepreciation.findUnique({ where: { assetId_period: { assetId: id, period } } })
  if (existing) throw new Error('Duplicate period')

  const cost = Number(asset.purchaseCost)
  const residual = Number(asset.residualValue ?? 0)
  const years = Number(asset.usefulLifeYears ?? 1)
  const currentBookValue = Number(asset.bookValue)
  const maxMonthly = Math.max(0, currentBookValue - residual)

  let monthlyDepn = 0
  if (asset.depreciationMethod === 'DECLINING_BALANCE') {
    if (cost > 0 && residual < cost) {
      const annualRate = 1 - Math.pow(residual / cost, 1 / years)
      monthlyDepn = currentBookValue * annualRate / 12
    }
  } else {
    monthlyDepn = (cost - residual) / (years * 12)
  }
  monthlyDepn = Math.min(r2(monthlyDepn), maxMonthly)

  const result = await prisma.$transaction(async (tx) => {
    const depn = await tx.assetDepreciation.create({
      data: { assetId: id, period, amount: monthlyDepn },
    })
    const newBookValue = currentBookValue - monthlyDepn
    const updated = await tx.fixedAsset.update({
      where: { id },
      data: {
        accumulatedDepreciation: { increment: monthlyDepn },
        bookValue: newBookValue,
        status: newBookValue <= residual ? 'FULLY_DEPRECIATED' : undefined,
      },
    })
    return { depreciation: depn, asset: updated }
  })
  return result
}

export async function disposeFixedAsset(id: string, data: { disposalDate?: string; disposalAmount?: number; disposalNotes?: string }) {
  const asset = await prisma.fixedAsset.findUnique({ where: { id } })
  if (!asset) throw new Error('Asset not found')

  return prisma.fixedAsset.update({
    where: { id },
    data: { status: 'DISPOSED', disposalDate: data.disposalDate ? new Date(data.disposalDate) : new Date(), disposalAmount: data.disposalAmount ?? 0, disposalNotes: data.disposalNotes } as any,
  })
}

// ── Journal Entries ─────────────────────────────────────────────────────

export function listJournalEntries() {
  return prisma.journalEntry.findMany({
    where: { deletedAt: null },
    include: { lines: true, createdBy: { select: { name: true } } },
    orderBy: { date: 'desc' }, take: 100,
  })
}

export async function createJournalEntry(data: { date: string; description: string; reference?: string; lines: { debitAccountId?: string; creditAccountId?: string; description?: string; debitAmount?: number; creditAmount?: number }[] }, userId: string) {
  let totalDebit = 0, totalCredit = 0
  for (const line of data.lines) {
    totalDebit += Number(line.debitAmount ?? 0)
    totalCredit += Number(line.creditAmount ?? 0)
  }
  if (Math.abs(totalDebit - totalCredit) > 0.01) throw new Error('Debit and credit totals must balance')

  const entryNumber = await nextDocNumber('journal_entry')
  return prisma.journalEntry.create({
    data: {
      entryNumber, date: new Date(data.date), description: data.description, reference: data.reference,
      createdById: userId,
      lines: { create: data.lines.map(l => ({ debitAccountId: l.debitAccountId, creditAccountId: l.creditAccountId, description: l.description, debitAmount: l.debitAmount ?? 0, creditAmount: l.creditAmount ?? 0 })) },
      status: 'DRAFT',
    },
    include: { lines: true },
  })
}

export async function postJournalEntry(id: string) {
  return prisma.journalEntry.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() } })
}

// ── Reports ─────────────────────────────────────────────────────────────

export async function getTrialBalance(from?: string | null, to?: string | null) {
  const whereDate: Record<string, unknown> = {}
  if (from) whereDate.gte = new Date(from)
  if (to) whereDate.lte = new Date(to)

  const accounts = await prisma.account.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } })
  const lines = await prisma.journalLine.findMany({
    where: { journal: { status: 'POSTED', ...(Object.keys(whereDate).length && { date: whereDate }) } },
    select: { debitAccountId: true, creditAccountId: true, debitAmount: true, creditAmount: true },
  })

  const totals: Record<string, { debit: number; credit: number }> = {}
  for (const line of lines) {
    if (line.debitAccountId) {
      if (!totals[line.debitAccountId]) totals[line.debitAccountId] = { debit: 0, credit: 0 }
      totals[line.debitAccountId].debit += Number(line.debitAmount)
    }
    if (line.creditAccountId) {
      if (!totals[line.creditAccountId]) totals[line.creditAccountId] = { debit: 0, credit: 0 }
      totals[line.creditAccountId].credit += Number(line.creditAmount)
    }
  }

  const rows = accounts.map(a => {
    const t = totals[a.id] ?? { debit: 0, credit: 0 }
    const balance = r2(t.debit - t.credit)
    return { account: a, totalDebit: r2(t.debit), totalCredit: r2(t.credit), balance }
  }).filter(r => r.balance !== 0)

  const grandDebit = r2(rows.reduce((s, r) => s + r.totalDebit, 0))
  const grandCredit = r2(rows.reduce((s, r) => s + r.totalCredit, 0))
  return { rows, totals: { totalDebit: grandDebit, totalCredit: grandCredit } }
}

export async function getPnL(from?: string | null, to?: string | null, costCentreId?: string | null) {
  const now = new Date()
  const dateFrom = from ? new Date(from) : new Date(now.getFullYear(), 0, 1)
  const dateTo = to ? new Date(to) : now

  const lines = await prisma.journalLine.findMany({
    where: {
      journal: { status: 'POSTED', date: { gte: dateFrom, lte: dateTo } },
      ...(costCentreId && { costCentreId }),
    },
    include: { debitAccount: { select: { id: true, code: true, name: true, type: true } }, creditAccount: { select: { id: true, code: true, name: true, type: true } } },
  })

  const revenueMap: Record<string, { account: { id: string; code: string; name: string }; net: number }> = {}
  const expenseMap: Record<string, { account: { id: string; code: string; name: string }; net: number }> = {}

  for (const line of lines) {
    if (line.creditAccount?.type === 'REVENUE') {
      const net = Number(line.creditAmount) - Number(line.debitAmount)
      if (!revenueMap[line.creditAccount.id]) revenueMap[line.creditAccount.id] = { account: line.creditAccount, net: 0 }
      revenueMap[line.creditAccount.id].net += net
    }
    if (line.debitAccount?.type === 'EXPENSE') {
      const net = Number(line.debitAmount) - Number(line.creditAmount)
      if (!expenseMap[line.debitAccount.id]) expenseMap[line.debitAccount.id] = { account: line.debitAccount, net: 0 }
      expenseMap[line.debitAccount.id].net += net
    }
  }

  const revenue = Object.values(revenueMap).map(r => ({ ...r, net: r2(r.net) })).filter(r => r.net !== 0)
  const expenses = Object.values(expenseMap).map(e => ({ ...e, net: r2(e.net) })).filter(e => e.net !== 0)
  const totalRevenue = r2(revenue.reduce((s, r) => s + r.net, 0))
  const totalExpenses = r2(expenses.reduce((s, e) => s + e.net, 0))
  return { revenue, expenses, totalRevenue, totalExpenses, netProfit: r2(totalRevenue - totalExpenses) }
}

export async function getBalanceSheet(asOf?: string | null) {
  const date = asOf ? new Date(asOf) : new Date()

  const lines = await prisma.journalLine.findMany({
    where: { journal: { status: 'POSTED', date: { lte: date } } },
    include: { debitAccount: { select: { id: true, code: true, name: true, type: true } }, creditAccount: { select: { id: true, code: true, name: true, type: true } } },
  })

  const balances: Record<string, { account: { id: string; code: string; name: string; type: string }; debit: number; credit: number }> = {}
  for (const line of lines) {
    if (line.debitAccountId && line.debitAccount) {
      if (!balances[line.debitAccountId]) balances[line.debitAccountId] = { account: line.debitAccount, debit: 0, credit: 0 }
      balances[line.debitAccountId].debit += Number(line.debitAmount)
    }
    if (line.creditAccountId && line.creditAccount) {
      if (!balances[line.creditAccountId]) balances[line.creditAccountId] = { account: line.creditAccount, debit: 0, credit: 0 }
      balances[line.creditAccountId].credit += Number(line.creditAmount)
    }
  }

  const assets: { account: { id: string; code: string; name: string }; balance: number }[] = []
  const liabilities: { account: { id: string; code: string; name: string }; balance: number }[] = []
  const equity: { account: { id: string; code: string; name: string }; balance: number }[] = []
  let retainedEarnings = 0

  for (const b of Object.values(balances)) {
    if (b.account.type === 'ASSET') {
      assets.push({ account: { id: b.account.id, code: b.account.code, name: b.account.name }, balance: r2(b.debit - b.credit) })
    } else if (b.account.type === 'LIABILITY') {
      liabilities.push({ account: { id: b.account.id, code: b.account.code, name: b.account.name }, balance: r2(b.credit - b.debit) })
    } else if (b.account.type === 'EQUITY') {
      equity.push({ account: { id: b.account.id, code: b.account.code, name: b.account.name }, balance: r2(b.credit - b.debit) })
    } else if (b.account.type === 'REVENUE') {
      retainedEarnings += b.credit - b.debit
    } else if (b.account.type === 'EXPENSE') {
      retainedEarnings -= b.debit - b.credit
    }
  }
  retainedEarnings = r2(retainedEarnings)

  const totalAssets = r2(assets.reduce((s, a) => s + a.balance, 0))
  const totalLiabilities = r2(liabilities.reduce((s, l) => s + l.balance, 0))
  const totalEquity = r2(equity.reduce((s, e) => s + e.balance, 0) + retainedEarnings)
  return {
    assets: { items: assets, total: totalAssets },
    liabilities: { items: liabilities, total: totalLiabilities },
    equity: { items: equity, retainedEarnings, total: totalEquity },
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.02,
  }
}

export async function getArAging(asOf?: string | null) {
  const now = asOf ? new Date(asOf) : new Date()
  const invoices = await prisma.customerInvoice.findMany({
    where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] } },
    include: { customer: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
  })
  const buckets = [
    { label: 'Current', min: -Infinity, max: 0, total: 0, count: 0 },
    { label: '1-30 Days', min: 1, max: 30, total: 0, count: 0 },
    { label: '31-60 Days', min: 31, max: 60, total: 0, count: 0 },
    { label: '61-90 Days', min: 61, max: 90, total: 0, count: 0 },
    { label: '90+ Days', min: 91, max: Infinity, total: 0, count: 0 },
  ]
  const rows = invoices.map(inv => {
    const outstanding = r2(Number(inv.totalAmount) - Number(inv.paidAmount ?? 0))
    const due = inv.dueDate ? Math.max(0, Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000)) : 0
    const bucket = buckets.find(b => due >= b.min && due <= b.max) ?? buckets[buckets.length - 1]
    bucket.total += outstanding; bucket.count++
    return { invoice: inv, outstanding, daysOverdue: due, bucket: bucket.label }
  })
  const grandTotal = r2(buckets.reduce((s, b) => s + b.total, 0))
  return { rows, buckets: buckets.map(b => ({ label: b.label, total: r2(b.total), count: b.count })), grandTotal }
}

export async function getApAging(asOf?: string | null) {
  const now = asOf ? new Date(asOf) : new Date()
  const invoices = await prisma.vendorInvoice.findMany({
    where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] } },
    include: { vendor: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
  })
  const buckets = [
    { label: 'Current', min: -Infinity, max: 0, total: 0, count: 0 },
    { label: '1-30 Days', min: 1, max: 30, total: 0, count: 0 },
    { label: '31-60 Days', min: 31, max: 60, total: 0, count: 0 },
    { label: '61-90 Days', min: 61, max: 90, total: 0, count: 0 },
    { label: '90+ Days', min: 91, max: Infinity, total: 0, count: 0 },
  ]
  const rows = invoices.map(inv => {
    const outstanding = r2(Number(inv.totalAmount) - Number(inv.paidAmount ?? 0))
    const due = inv.dueDate ? Math.max(0, Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000)) : 0
    const bucket = buckets.find(b => due >= b.min && due <= b.max) ?? buckets[buckets.length - 1]
    bucket.total += outstanding; bucket.count++
    return { invoice: inv, outstanding, daysOverdue: due, bucket: bucket.label }
  })
  const grandTotal = r2(buckets.reduce((s, b) => s + b.total, 0))
  return { rows, buckets: buckets.map(b => ({ label: b.label, total: r2(b.total), count: b.count })), grandTotal }
}

// ── Tax Rates ───────────────────────────────────────────────────────────

export function listTaxRates() {
  return prisma.taxRate.findMany({ orderBy: [{ taxType: 'asc' }, { name: 'asc' }] })
}

export function createTaxRate(data: Record<string, unknown>) {
  return prisma.taxRate.create({ data: data as any })
}

export function updateTaxRate(id: string, data: Record<string, unknown>) {
  return prisma.taxRate.update({ where: { id }, data: data as any })
}

export function deleteTaxRate(id: string) {
  return prisma.taxRate.delete({ where: { id } })
}
