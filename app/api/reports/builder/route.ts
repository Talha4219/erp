import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModuleAccess } from '@/lib/authz'

// Report data source definitions
const DATA_SOURCES = {
  sales_orders: {
    label: 'Sales Orders',
    columns: [
      { key: 'soNumber', label: 'SO Number', type: 'string' },
      { key: 'orderDate', label: 'Order Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'customer.name', label: 'Customer', type: 'string' },
      { key: 'subTotal', label: 'Sub Total', type: 'number' },
      { key: 'taxAmount', label: 'Tax', type: 'number' },
      { key: 'totalAmount', label: 'Total', type: 'number' },
    ],
  },
  customer_invoices: {
    label: 'Customer Invoices',
    columns: [
      { key: 'invoiceNumber', label: 'Invoice #', type: 'string' },
      { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'customer.name', label: 'Customer', type: 'string' },
      { key: 'totalAmount', label: 'Total', type: 'number' },
      { key: 'paidAmount', label: 'Paid', type: 'number' },
    ],
  },
  purchase_orders: {
    label: 'Purchase Orders',
    columns: [
      { key: 'poNumber', label: 'PO Number', type: 'string' },
      { key: 'orderDate', label: 'Order Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'vendor.name', label: 'Vendor', type: 'string' },
      { key: 'totalAmount', label: 'Total', type: 'number' },
      { key: 'grandTotal', label: 'Grand Total', type: 'number' },
    ],
  },
  employees: {
    label: 'Employees',
    columns: [
      { key: 'employeeCode', label: 'Code', type: 'string' },
      { key: 'firstName', label: 'First Name', type: 'string' },
      { key: 'lastName', label: 'Last Name', type: 'string' },
      { key: 'department.name', label: 'Department', type: 'string' },
      { key: 'designation.name', label: 'Designation', type: 'string' },
      { key: 'basicSalary', label: 'Basic Salary', type: 'number' },
      { key: 'joinDate', label: 'Join Date', type: 'date' },
    ],
  },
  payroll: {
    label: 'Payroll',
    columns: [
      { key: 'employee.firstName', label: 'First Name', type: 'string' },
      { key: 'employee.lastName', label: 'Last Name', type: 'string' },
      { key: 'month', label: 'Month', type: 'number' },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'grossSalary', label: 'Gross', type: 'number' },
      { key: 'totalDeductions', label: 'Deductions', type: 'number' },
      { key: 'netSalary', label: 'Net Salary', type: 'number' },
      { key: 'isPaid', label: 'Paid', type: 'boolean' },
    ],
  },
  inventory: {
    label: 'Inventory Items',
    columns: [
      { key: 'sku', label: 'SKU', type: 'string' },
      { key: 'name', label: 'Item Name', type: 'string' },
      { key: 'category.name', label: 'Category', type: 'string' },
      { key: 'unitPrice', label: 'Unit Price', type: 'number' },
      { key: 'costPrice', label: 'Cost Price', type: 'number' },
      { key: 'reorderPoint', label: 'Reorder Point', type: 'number' },
    ],
  },
  journal_entries: {
    label: 'Journal Entries',
    columns: [
      { key: 'entryNumber', label: 'Entry #', type: 'string' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'description', label: 'Description', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'reference', label: 'Reference', type: 'string' },
    ],
  },
}

export type DataSourceKey = keyof typeof DATA_SOURCES

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

// GET /api/reports/builder — returns available data sources and columns
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'reports')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'sources') {
    return NextResponse.json(
      { success: true, data: DATA_SOURCES },
      { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    )
  }

  // List saved reports (own + shared)
  const reports = await prisma.savedReport.findMany({
    where: { OR: [{ createdById: session.user.id }, { isShared: true }] },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ success: true, data: reports })
}

// POST /api/reports/builder — execute a report config or save it
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'reports')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { action, source, columns, filters, sortBy, sortDir, limit = 500, name, description } = body

  if (!source || !(source in DATA_SOURCES)) {
    return NextResponse.json({ success: false, error: 'Invalid data source' }, { status: 400 })
  }

  // Build Prisma query based on source
  const rows = await executeReport(source as DataSourceKey, { filters, sortBy, sortDir, limit })

  // Project only requested columns
  const selectedCols: string[] = columns?.length ? columns : DATA_SOURCES[source as DataSourceKey].columns.map((c) => c.key)
  const projected = rows.map((row) => {
    const out: Record<string, unknown> = {}
    selectedCols.forEach((col) => {
      out[col] = getNestedValue(row as Record<string, unknown>, col)
    })
    return out
  })

  // Save report if action === 'save'
  if (action === 'save' && name) {
    const saved = await prisma.savedReport.create({
      data: {
        name,
        description: description ?? null,
        module: source,
        filters: (filters ?? []) as object[],
        columns: selectedCols,
        sortBy: sortBy ? { field: sortBy, dir: sortDir ?? 'asc' } : undefined,
        createdById: session.user.id,
      },
    })
    return NextResponse.json({ success: true, data: { report: saved, rows: projected } }, { status: 201 })
  }

  return NextResponse.json({ success: true, data: { rows: projected, total: projected.length } })
}

async function executeReport(source: DataSourceKey, opts: {
  filters?: Array<{ field: string; op: string; value: unknown }>
  sortBy?: string
  sortDir?: string
  limit?: number
}): Promise<Record<string, unknown>[]> {
  const { filters = [], sortBy, sortDir = 'asc', limit = 500 } = opts

  // Build where clause from filters
  const where: Record<string, unknown> = { deletedAt: null }
  for (const f of filters) {
    if (!f.field || !f.value) continue
    const topField = f.field.split('.')[0]
    switch (f.op) {
      case 'eq':   where[topField] = f.value; break
      case 'neq':  where[topField] = { not: f.value }; break
      case 'gt':   where[topField] = { gt: f.value }; break
      case 'lt':   where[topField] = { lt: f.value }; break
      case 'gte':  where[topField] = { gte: new Date(f.value as string) }; break
      case 'lte':  where[topField] = { lte: new Date(f.value as string) }; break
      case 'contains': where[topField] = { contains: f.value, mode: 'insensitive' }; break
    }
  }

  // Build orderBy
  const orderBy = sortBy
    ? [{ [sortBy.split('.')[0]]: sortDir === 'desc' ? 'desc' : 'asc' }]
    : [{ createdAt: 'desc' as const }]

  switch (source) {
    case 'sales_orders':
      return prisma.salesOrder.findMany({
        where,
        include: { customer: { select: { name: true } } },
        orderBy,
        take: limit,
      }) as unknown as Record<string, unknown>[]

    case 'customer_invoices':
      return prisma.customerInvoice.findMany({
        where,
        include: { customer: { select: { name: true } } },
        orderBy,
        take: limit,
      }) as unknown as Record<string, unknown>[]

    case 'purchase_orders':
      return prisma.purchaseOrder.findMany({
        where,
        include: { vendor: { select: { name: true } } },
        orderBy,
        take: limit,
      }) as unknown as Record<string, unknown>[]

    case 'employees':
      return prisma.employee.findMany({
        where: { isActive: true },
        include: {
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
        orderBy,
        take: limit,
      }) as unknown as Record<string, unknown>[]

    case 'payroll':
      return prisma.payroll.findMany({
        where,
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy,
        take: limit,
      }) as unknown as Record<string, unknown>[]

    case 'inventory':
      return prisma.item.findMany({
        where: { isActive: true },
        include: { category: { select: { name: true } } },
        orderBy,
        take: limit,
      }) as unknown as Record<string, unknown>[]

    case 'journal_entries':
      return prisma.journalEntry.findMany({
        where,
        orderBy,
        take: limit,
      }) as unknown as Record<string, unknown>[]

    default:
      return []
  }
}
