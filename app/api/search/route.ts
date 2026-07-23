import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModuleAccess } from '@/lib/authz'

export type SearchResult = {
  id: string
  type: string
  label: string
  subLabel?: string
  href: string
}

const MAX_PER_MODULE = 5

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const allowedModules = ['crm', 'procurement', 'inventory', 'sales', 'hr', 'finance']
  if (!allowedModules.some(m => hasModuleAccess(session, m))) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ success: true, data: [] })

  const contains = { contains: q, mode: 'insensitive' as const }

  const results: SearchResult[] = []

  const [customers, vendors, items, salesOrders, invoices, purchaseOrders, employees, journals] =
    await Promise.all([
      prisma.customer.findMany({
        where: { OR: [{ name: contains }, { email: contains }, { phone: contains }] },
        select: { id: true, name: true, email: true },
        take: MAX_PER_MODULE,
      }),
      prisma.vendor.findMany({
        where: { OR: [{ name: contains }, { email: contains }] },
        select: { id: true, name: true, email: true },
        take: MAX_PER_MODULE,
      }),
      prisma.item.findMany({
        where: { OR: [{ name: contains }, { sku: contains }, { description: contains }] },
        select: { id: true, name: true, sku: true },
        take: MAX_PER_MODULE,
      }),
      prisma.salesOrder.findMany({
        where: { OR: [{ soNumber: contains }, { customer: { name: contains } }] },
        select: { id: true, soNumber: true, customer: { select: { name: true } } },
        take: MAX_PER_MODULE,
      }),
      prisma.customerInvoice.findMany({
        where: { OR: [{ invoiceNumber: contains }, { customer: { name: contains } }] },
        select: { id: true, invoiceNumber: true, customer: { select: { name: true } } },
        take: MAX_PER_MODULE,
      }),
      prisma.purchaseOrder.findMany({
        where: { OR: [{ poNumber: contains }, { vendor: { name: contains } }] },
        select: { id: true, poNumber: true, vendor: { select: { name: true } } },
        take: MAX_PER_MODULE,
      }),
      prisma.employee.findMany({
        where: { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }, { employeeCode: contains }] },
        select: { id: true, firstName: true, lastName: true, email: true, employeeCode: true },
        take: MAX_PER_MODULE,
      }),
      prisma.journalEntry.findMany({
        where: { OR: [{ description: contains }, { reference: contains }] },
        select: { id: true, reference: true, description: true },
        take: MAX_PER_MODULE,
      }),
    ])

  for (const c of customers) {
    results.push({ id: c.id, type: 'Customer', label: c.name, subLabel: c.email ?? undefined, href: `/crm/customers/${c.id}` })
  }
  for (const v of vendors) {
    results.push({ id: v.id, type: 'Vendor', label: v.name, subLabel: v.email ?? undefined, href: `/procurement/vendors/${v.id}` })
  }
  for (const it of items) {
    results.push({ id: it.id, type: 'Item', label: it.name, subLabel: it.sku ?? undefined, href: `/inventory/items/${it.id}` })
  }
  for (const so of salesOrders) {
    results.push({ id: so.id, type: 'Sales Order', label: so.soNumber, subLabel: so.customer.name, href: `/sales/orders/${so.id}` })
  }
  for (const inv of invoices) {
    results.push({ id: inv.id, type: 'Invoice', label: inv.invoiceNumber, subLabel: inv.customer.name, href: `/sales/invoices/${inv.id}` })
  }

  for (const po of purchaseOrders) {
    results.push({ id: po.id, type: 'Purchase Order', label: po.poNumber, subLabel: po.vendor.name, href: `/procurement/orders/${po.id}` })
  }
  for (const emp of employees) {
    results.push({
      id: emp.id, type: 'Employee',
      label: `${emp.firstName} ${emp.lastName}`,
      subLabel: emp.employeeCode ?? emp.email ?? undefined,
      href: `/hr/employees/${emp.id}`,
    })
  }
  for (const j of journals) {
    results.push({ id: j.id, type: 'Journal', label: j.reference ?? j.description ?? 'Journal Entry', href: `/finance/journal/${j.id}` })
  }

  return NextResponse.json({ success: true, data: results })
}
