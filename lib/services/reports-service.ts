import prisma from '@/lib/prisma'

export async function getReport(reportType: string, dateFrom?: string, dateTo?: string) {
  const from = dateFrom ? new Date(dateFrom) : new Date(0)
  const to = dateTo ? new Date(dateTo) : new Date()

  switch (reportType) {
    case 'sales': {
      const orders = await prisma.salesOrder.findMany({
        where: { orderDate: { gte: from, lte: to }, deletedAt: null },
        include: { lineItems: true, customer: { select: { name: true } } },
        orderBy: { orderDate: 'desc' },
      })
      const summary = {
        totalOrders: orders.length,
        totalValue: orders.reduce((s, o) => s + Number(o.totalAmount), 0),
        avgOrderValue: orders.length ? orders.reduce((s, o) => s + Number(o.totalAmount), 0) / orders.length : 0,
      }
      return { data: orders, summary }
    }
    case 'purchase': {
      const orders = await prisma.purchaseOrder.findMany({
        where: { orderDate: { gte: from, lte: to }, deletedAt: null },
        include: { lineItems: true, vendor: { select: { name: true } } },
        orderBy: { orderDate: 'desc' },
      })
      const summary = {
        totalOrders: orders.length,
        totalValue: orders.reduce((s, o) => s + Number(o.totalAmount), 0),
      }
      return { data: orders, summary }
    }
    case 'inventory': {
      const items = await prisma.item.findMany({
        where: { deletedAt: null },
        include: { warehouseStocks: true, category: { select: { name: true } } },
        orderBy: { name: 'asc' },
      })
      const summary = {
        totalItems: items.length,
        lowStock: items.filter((i) => Number(i.reorderPoint) > 0 && i.warehouseStocks.reduce((s, ws) => s + Number(ws.quantity), 0) <= Number(i.reorderPoint)).length,
        totalValue: items.reduce((s, i) => s + Number(i.standardCost) * i.warehouseStocks.reduce((ss, ws) => ss + Number(ws.quantity), 0), 0),
      }
      return { data: items, summary }
    }
    case 'payroll': {
      const yearStart = from.getFullYear()
      const yearEnd = to.getFullYear()
      const monthStart = from.getMonth() + 1
      const monthEnd = to.getMonth() + 1
      const payrolls = await prisma.payroll.findMany({
        where: { year: { gte: yearStart, lte: yearEnd }, month: { gte: monthStart, lte: monthEnd } },
        include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      })
      const summary = {
        totalPayrolls: payrolls.length,
        totalGross: payrolls.reduce((s, p) => s + Number(p.grossSalary), 0),
        totalNet: payrolls.reduce((s, p) => s + Number(p.netSalary), 0),
        totalTax: payrolls.reduce((s, p) => s + Number(p.taxDeduction) + Number(p.niEmployee), 0),
      }
      return { data: payrolls, summary }
    }
    case 'trial-balance': {
      const accounts = await prisma.account.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      })
      const accountIds = accounts.map((a) => a.id)
      const [debitSums, creditSums] = await Promise.all([
        prisma.journalLine.groupBy({ by: ['debitAccountId'], _sum: { debitAmount: true }, where: { debitAccountId: { in: accountIds } } }),
        prisma.journalLine.groupBy({ by: ['creditAccountId'], _sum: { creditAmount: true }, where: { creditAccountId: { in: accountIds } } }),
      ])
      const debitMap = Object.fromEntries(debitSums.map((r) => [r.debitAccountId, Number(r._sum.debitAmount ?? 0)]))
      const creditMap = Object.fromEntries(creditSums.map((r) => [r.creditAccountId, Number(r._sum.creditAmount ?? 0)]))
      const totalDebit = accounts.reduce((s, a) => s + (debitMap[a.id] ?? 0), 0)
      const totalCredit = accounts.reduce((s, a) => s + (creditMap[a.id] ?? 0), 0)
      const difference = Math.abs(totalDebit - totalCredit)
      const accountsWithBalances = accounts.map((a) => ({ ...a, debitBalance: debitMap[a.id] ?? 0, creditBalance: creditMap[a.id] ?? 0 }))
      return { data: accountsWithBalances, summary: { totalDebit, totalCredit, difference, balanced: difference < 0.01 } }
    }
    case 'receivables-aging': {
      const invoices = await prisma.customerInvoice.findMany({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        include: { customer: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
      })
      const now = new Date()
      const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days91plus: 0 }
      for (const inv of invoices) {
        const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        const owed = Number(inv.totalAmount) - Number(inv.paidAmount ?? 0)
        if (daysOverdue <= 0) buckets.current += owed
        else if (daysOverdue <= 30) buckets.days1to30 += owed
        else if (daysOverdue <= 60) buckets.days31to60 += owed
        else if (daysOverdue <= 90) buckets.days61to90 += owed
        else buckets.days91plus += owed
      }
      return { data: invoices, summary: buckets }
    }
    case 'yearly-expenses': {
      const currentYear = new Date().getFullYear()
      const expenseAccountIds = await getExpenseAccountIds()
      const entries = await prisma.journalEntry.findMany({
        where: { date: { gte: new Date(currentYear, 0, 1), lte: new Date(currentYear, 11, 31) } },
        include: { lines: { where: { debitAccountId: { in: expenseAccountIds } } } },
        orderBy: { date: 'asc' },
      })
      const monthlyTotals = Array(12).fill(0)
      for (const je of entries) {
        const month = je.date.getMonth()
        for (const line of je.lines) monthlyTotals[month] += Number(line.debitAmount) - Number(line.creditAmount)
      }
      return { data: entries, summary: { year: currentYear, monthlyTotals, total: monthlyTotals.reduce((s, v) => s + v, 0) } }
    }
    default:
      throw new Error(`Unknown report type: ${reportType}`)
  }
}

async function getExpenseAccountIds() {
  const accounts = await prisma.account.findMany({ where: { type: 'EXPENSE' }, select: { id: true } })
  return accounts.map((a) => a.id)
}

const REPORT_DATA_SOURCES = [
  { key: 'sales_orders', label: 'Sales Orders', fields: ['soNumber', 'customerId', 'orderDate', 'totalAmount', 'status'] },
  { key: 'customer_invoices', label: 'Customer Invoices', fields: ['invoiceNumber', 'customerId', 'invoiceDate', 'dueDate', 'totalAmount', 'status'] },
  { key: 'purchase_orders', label: 'Purchase Orders', fields: ['poNumber', 'vendorId', 'orderDate', 'totalAmount', 'status'] },
  { key: 'employees', label: 'Employees', fields: ['employeeCode', 'firstName', 'lastName', 'email', 'departmentId'] },
  { key: 'payroll', label: 'Payroll', fields: ['employeeId', 'month', 'year', 'grossSalary', 'netSalary', 'taxDeduction'] },
  { key: 'inventory', label: 'Inventory/Stock', fields: ['name', 'sku', 'categoryId', 'reorderPoint', 'sellingPrice'] },
  { key: 'journal_entries', label: 'Journal Entries', fields: ['entryNumber', 'date', 'description', 'debitAmount', 'creditAmount', 'code'] },
]

export function listReportSources() {
  return REPORT_DATA_SOURCES
}

async function executeReport(config: { source: string; filters?: Record<string, string>; sortBy?: string; sortOrder?: string; columns?: string[]; limit?: number }) {
  const { source, filters = {}, sortBy, sortOrder = 'asc', columns, limit = 100 } = config

  const queryWhere: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(filters)) {
    if (value) queryWhere[field] = { contains: value, mode: 'insensitive' }
  }

  let data: any[] = []
  switch (source) {
    case 'sales_orders':
      data = await prisma.salesOrder.findMany({ where: { deletedAt: null, ...queryWhere } as any, orderBy: { [sortBy || 'orderDate']: sortOrder }, take: limit })
      break
    case 'customer_invoices':
      data = await prisma.customerInvoice.findMany({ where: { deletedAt: null, ...queryWhere } as any, orderBy: { [sortBy || 'invoiceDate']: sortOrder }, take: limit })
      break
    case 'purchase_orders':
      data = await prisma.purchaseOrder.findMany({ where: { deletedAt: null, ...queryWhere } as any, orderBy: { [sortBy || 'orderDate']: sortOrder }, take: limit })
      break
    case 'employees':
      data = await prisma.employee.findMany({ where: { deletedAt: null, ...queryWhere } as any, orderBy: { [sortBy || 'firstName']: sortOrder }, take: limit })
      break
    case 'payroll':
      data = await prisma.payroll.findMany({ where: { ...queryWhere } as any, orderBy: { [sortBy || 'year']: sortOrder }, take: limit })
      break
    case 'inventory':
      data = await prisma.item.findMany({ where: { deletedAt: null, ...queryWhere, warehouseStocks: { some: {} } } as any, include: { warehouseStocks: true }, orderBy: { [sortBy || 'name']: sortOrder }, take: limit })
      break
    case 'journal_entries':
      data = await prisma.journalEntry.findMany({ where: { ...queryWhere } as any, include: { lines: true }, orderBy: { [sortBy || 'date']: sortOrder }, take: limit })
      break
  }

  if (columns?.length) {
    data = data.map((row) => {
      const filtered: Record<string, unknown> = {}
      for (const col of columns) {
        if (col in row) filtered[col] = (row as any)[col]
      }
      return filtered
    })
  }

  return { data, total: data.length, source, columns: columns || undefined }
}

export async function listSavedReports() {
  return prisma.savedReport.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function saveReport(data: { name: string; source: string; config: any }) {
  return prisma.savedReport.create({ data: { name: data.name, module: data.source, filters: data.config ?? {}, columns: [], createdById: 'system' } })
}

export { executeReport }
