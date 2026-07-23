import prisma from '@/lib/prisma'
import { nextDocNumber } from '@/lib/services/numbering'
import { nextPriceListCode, nextSalesReturnNumber } from '@/lib/codes'

// ── Customer Ratings ──────────────────────────────────────────────────────

export function listCustomerRatings(customerId?: string | null) {
  return prisma.customerRating.findMany({
    where: customerId ? { customerId } : {},
    include: { customer: { select: { name: true, customerCode: true } } },
    orderBy: { ratedAt: 'desc' },
  })
}

export function createCustomerRating(data: {
  customerId: string
  ratedByName: string
  overallScore: number
  paymentScore?: number
  businessScore?: number
  relationshipScore?: number
  notes?: string | null
}) {
  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)))
  return prisma.customerRating.create({
    data: {
      customerId: data.customerId,
      ratedByName: data.ratedByName,
      overallScore: clamp(data.overallScore),
      paymentScore: clamp(data.paymentScore ?? 0),
      businessScore: clamp(data.businessScore ?? 0),
      relationshipScore: clamp(data.relationshipScore ?? 0),
      notes: data.notes ?? null,
    },
  })
}

export function deleteCustomerRating(id: string) {
  return prisma.customerRating.delete({ where: { id } })
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export async function getSalesDashboard() {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)

  const [
    revenueAgg,
    allOutstanding,
    overdueList,
    activeCustomers,
    openOrders,
    recentInvoices,
    topCustomerData,
    recentOrders,
    chartInvoices,
    leadCount,
    opportunityCount,
    quotationCount,
    orderCount,
    invoiceCount,
    topProductRows,
  ] = await Promise.all([
    prisma.customerInvoice.aggregate({
      where: { status: 'PAID', deletedAt: null },
      _sum: { paidAmount: true },
    }),
    prisma.customerInvoice.findMany({
      where: { status: { in: ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] }, deletedAt: null },
      select: { totalAmount: true, paidAmount: true },
    }),
    prisma.customerInvoice.findMany({
      where: { status: 'OVERDUE', deletedAt: null },
      select: { totalAmount: true, paidAmount: true },
    }),
    prisma.customer.count({ where: { isActive: true, deletedAt: null } }),
    prisma.salesOrder.count({ where: { status: { in: ['DRAFT', 'CONFIRMED'] }, deletedAt: null } }),
    prisma.customerInvoice.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.customerInvoice.groupBy({
      by: ['customerId'],
      where: { deletedAt: null, NOT: { status: 'CANCELLED' } },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    }),
    prisma.salesOrder.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.customerInvoice.findMany({
      where: { invoiceDate: { gte: sixMonthsAgo }, deletedAt: null, status: { in: ['PAID', 'PARTIALLY_PAID'] } },
      select: { invoiceDate: true, paidAmount: true },
    }),
    prisma.crmLead.count({ where: { deletedAt: null } }),
    prisma.crmOpportunity.count({ where: { deletedAt: null } }),
    prisma.quotation.count({ where: { deletedAt: null } }),
    prisma.salesOrder.count({ where: { deletedAt: null, status: { not: 'CANCELLED' } } }),
    prisma.customerInvoice.count({ where: { deletedAt: null, status: { not: 'CANCELLED' } } }),
    prisma.invoiceItem.groupBy({
      by: ['itemId'],
      where: { itemId: { not: null }, invoice: { deletedAt: null, status: { not: 'CANCELLED' } } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 5,
    }),
  ])

  const custIds = topCustomerData.map((c) => c.customerId)
  const custNames = await prisma.customer.findMany({
    where: { id: { in: custIds } },
    select: { id: true, name: true },
  })
  const custMap = Object.fromEntries(custNames.map((c) => [c.id, c.name]))

  const productIds = topProductRows.map((r) => r.itemId).filter((id): id is string => id !== null)
  const products = await prisma.item.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
  const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]))
  const topProducts = topProductRows.map((r) => ({
    name: productMap[r.itemId ?? ''] ?? 'Unknown',
    quantity: Number(r._sum.quantity ?? 0),
    revenue: Number(r._sum.totalPrice ?? 0),
  }))

  const funnel = [
    { stage: 'Leads', count: leadCount },
    { stage: 'Opportunities', count: opportunityCount },
    { stage: 'Quotations', count: quotationCount },
    { stage: 'Orders', count: orderCount },
    { stage: 'Invoices', count: invoiceCount },
  ]

  const monthLabels: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    monthLabels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }))
  }
  const monthlyMap: Record<string, number> = {}
  for (const label of monthLabels) monthlyMap[label] = 0
  for (const inv of chartInvoices) {
    const label = new Date(inv.invoiceDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    if (label in monthlyMap) monthlyMap[label] += Number(inv.paidAmount)
  }

  return {
    totalRevenue: Number(revenueAgg._sum.paidAmount ?? 0),
    outstanding: allOutstanding.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0),
    overdueCount: overdueList.length,
    overdueAmount: overdueList.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0),
    activeCustomers,
    openOrders,
    monthlyRevenue: monthLabels.map((month) => ({ month, revenue: monthlyMap[month] })),
    recentInvoices,
    topCustomers: topCustomerData.map((c) => ({
      name: custMap[c.customerId] ?? 'Unknown',
      totalAmount: Number(c._sum.totalAmount ?? 0),
    })),
    recentOrders,
    funnel,
    topProducts,
  }
}

// ── Delivery Notes ────────────────────────────────────────────────────────

export function listDeliveryNotes() {
  return prisma.deliveryNote.findMany({
    where: { deletedAt: null },
    include: { customer: { select: { name: true } }, so: { select: { soNumber: true } }, _count: { select: { lineItems: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function createDeliveryNote(data: {
  soId: string
  customerId: string
  deliveryDate: Date
  carrier?: string | null
  trackingNumber?: string | null
  notes?: string | null
  lineItems?: Array<{ description: string; orderedQty: number; deliveredQty: number; soItemId?: string; itemId?: string | null }>
}) {
  const dnNumber = await nextDocNumber('delivery_note')
  return prisma.deliveryNote.create({
    data: {
      dnNumber,
      soId: data.soId,
      customerId: data.customerId,
      deliveryDate: data.deliveryDate,
      carrier: data.carrier ?? null,
      trackingNumber: data.trackingNumber ?? null,
      notes: data.notes ?? null,
      lineItems: data.lineItems?.length ? { createMany: { data: data.lineItems as any } } : undefined,
    },
    include: { lineItems: true },
  })
}

export function getDeliveryNote(id: string) {
  return prisma.deliveryNote.findUnique({
    where: { id },
    include: { customer: true, so: { include: { lineItems: true } }, lineItems: true },
  })
}

export async function updateDeliveryNote(id: string, data: Record<string, unknown>) {
  return prisma.deliveryNote.update({
    where: { id },
    data: data as any,
    include: { lineItems: true },
  })
}

export function softDeleteDeliveryNote(id: string) {
  return prisma.deliveryNote.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Discounts ─────────────────────────────────────────────────────────────

export function listDiscounts() {
  return prisma.discountRule.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 })
}

export function createDiscount(data: {
  code: string
  name: string
  type?: string
  value: number
  minOrderValue?: number | null
  maxUsage?: number | null
  startDate?: Date | null
  endDate?: Date | null
  description?: string | null
}) {
  return prisma.discountRule.create({
    data: {
      code: data.code,
      name: data.name,
      type: (data.type ?? 'PERCENTAGE') as any,
      value: data.value,
      minOrderValue: data.minOrderValue ?? null,
      maxUsage: data.maxUsage ?? null,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      description: data.description ?? null,
    },
  })
}

const discountUpdateFields = ['code', 'name', 'type', 'description', 'isActive'] as const

export function sanitizeDiscountInput(body: Record<string, unknown>): Record<string, unknown> {
  const allowed: Record<string, unknown> = {}
  for (const f of discountUpdateFields) {
    if (body[f] !== undefined) allowed[f] = body[f]
  }
  if (body.value !== undefined) allowed.value = Number(body.value)
  if (body.minOrderValue !== undefined) allowed.minOrderValue = body.minOrderValue ? Number(body.minOrderValue) : null
  if (body.maxUsage !== undefined) allowed.maxUsage = body.maxUsage ? Number(body.maxUsage) : null
  if (body.startDate !== undefined) allowed.startDate = body.startDate ? new Date(body.startDate as string) : null
  if (body.endDate !== undefined) allowed.endDate = body.endDate ? new Date(body.endDate as string) : null
  return allowed
}

export function updateDiscount(id: string, data: Record<string, unknown>) {
  return prisma.discountRule.update({ where: { id }, data: data as any })
}

export function softDeleteDiscount(id: string) {
  return prisma.discountRule.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Price Lists ───────────────────────────────────────────────────────────

export function listPriceLists() {
  return prisma.priceList.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function createPriceList(data: {
  name: string
  currency?: string
  startDate?: Date | null
  endDate?: Date | null
  isDefault?: boolean
  description?: string | null
}) {
  const code = await nextPriceListCode()
  if (data.isDefault) {
    await prisma.priceList.updateMany({ where: { isDefault: true, deletedAt: null }, data: { isDefault: false } })
  }
  return prisma.priceList.create({
    data: {
      code,
      name: data.name,
      currency: data.currency ?? 'GBP',
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      isDefault: !!data.isDefault,
      description: data.description ?? null,
    },
  })
}

export function getPriceList(id: string) {
  return prisma.priceList.findUnique({ where: { id }, include: { items: { include: { item: true } } } })
}

export async function updatePriceList(tx: any, id: string, data: Record<string, unknown>, items?: Array<{ description: string; unitPrice: number; minQty?: number; discount?: number; itemId?: string }>) {
  if (items !== undefined) {
    await tx.priceListItem.deleteMany({ where: { priceListId: id } })
    if (items.length > 0) {
      await tx.priceListItem.createMany({ data: items.map((i) => ({ ...i, priceListId: id })) })
    }
  }
  return tx.priceList.update({ where: { id }, data: data as any })
}

export function softDeletePriceList(id: string) {
  return prisma.priceList.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Sales Returns (list/create) ───────────────────────────────────────────

export function listSalesReturns() {
  return prisma.salesReturn.findMany({
    where: { deletedAt: null },
    include: { customer: { select: { name: true } }, invoice: { select: { invoiceNumber: true } }, creditNote: { select: { creditNoteNumber: true, status: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function createSalesReturn(data: {
  invoiceId: string
  customerId: string
  returnDate: Date
  reason: string
  notes?: string | null
  lineItems?: Array<{ description?: string; quantity?: number; unitPrice?: number; itemId?: string; warehouseId?: string }>
}) {
  const returnNumber = await nextSalesReturnNumber()
  const totalAmount = (data.lineItems ?? []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)
  return prisma.salesReturn.create({
    data: {
      returnNumber,
      invoiceId: data.invoiceId,
      customerId: data.customerId,
      returnDate: data.returnDate,
      reason: data.reason,
      notes: data.notes ?? null,
      totalAmount,
      lineItems: data.lineItems?.length
        ? {
            createMany: {
              data: data.lineItems.map((li) => ({
                description: li.description ?? '',
                quantity: Number(li.quantity) || 0,
                unitPrice: Number(li.unitPrice) || 0,
                totalPrice: (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0),
                itemId: li.itemId ?? null,
                warehouseId: li.warehouseId ?? null,
              })),
            },
          }
        : undefined,
    },
    include: { lineItems: true },
  })
}

// ── Statements ─────────────────────────────────────────────────────────────

export async function getCustomerStatement(customerId: string, from?: string | null, to?: string | null) {
  const dateFilter: Record<string, Date | { gte?: Date; lte?: Date }> = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) dateFilter.lte = new Date(to)

  const [customer, invoices, payments] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, email: true, phone: true, address: true, city: true, country: true } }),
    prisma.customerInvoice.findMany({
      where: { customerId, deletedAt: null, ...(from || to ? { invoiceDate: dateFilter as any } : {}) },
      select: { id: true, invoiceNumber: true, invoiceDate: true, dueDate: true, totalAmount: true, paidAmount: true, status: true },
      orderBy: { invoiceDate: 'asc' },
    }),
    prisma.customerPayment.findMany({
      where: { invoice: { customerId }, ...(from || to ? { paymentDate: dateFilter as any } : {}) },
      select: { id: true, amount: true, paymentDate: true, method: true, reference: true, invoice: { select: { invoiceNumber: true } } },
      orderBy: { paymentDate: 'asc' },
    }),
  ])

  if (!customer) return null

  const totalBilled = invoices.reduce((s, i) => s + Number(i.totalAmount), 0)
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0)
  const totalOutstanding = totalBilled - totalPaid
  const overdueInvoices = invoices.filter((i) => i.status === 'OVERDUE' || (new Date(i.dueDate) < new Date() && i.status !== 'PAID'))

  return { customer, invoices, payments, summary: { totalBilled, totalPaid, totalOutstanding, overdueCount: overdueInvoices.length } }
}

// ── Tax Rates ─────────────────────────────────────────────────────────────

export function listTaxRates() {
  return prisma.taxRate.findMany({ orderBy: { rate: 'asc' } })
}

export async function createTaxRate(data: {
  code: string
  name: string
  rate: number
  description?: string | null
  isDefault?: boolean
}) {
  if (data.isDefault) {
    await prisma.taxRate.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
  }
  return prisma.taxRate.create({
    data: { code: data.code, name: data.name, rate: data.rate, description: data.description ?? null, isDefault: !!data.isDefault },
  })
}

const taxRateUpdateFields = ['code', 'name', 'taxType', 'description', 'isActive', 'accountId'] as const

export function sanitizeTaxRateInput(body: Record<string, unknown>): Record<string, unknown> {
  const allowed: Record<string, unknown> = {}
  for (const f of taxRateUpdateFields) {
    if (body[f] !== undefined) allowed[f] = body[f]
  }
  if (body.rate !== undefined) allowed.rate = Number(body.rate)
  if (body.isDefault !== undefined) {
    allowed.isDefault = body.isDefault
    if (body.isDefault) {
      prisma.taxRate.updateMany({ where: { isDefault: true }, data: { isDefault: false } }).catch(() => {})
    }
  }
  return allowed
}

export function updateTaxRate(id: string, data: Record<string, unknown>) {
  return prisma.taxRate.update({ where: { id }, data: data as any })
}

export function deleteTaxRate(id: string) {
  return prisma.taxRate.delete({ where: { id } })
}

// ── Customer Import ───────────────────────────────────────────────────────

export const CUSTOMER_IMPORT_TEMPLATE_COLUMNS = [
  'Customer Code', 'Customer Name', 'Contact Person', 'Email', 'Phone',
  'Address', 'City', 'Country', 'Tax ID', 'Credit Limit', 'Payment Terms (Days)',
]

export async function importCustomers(rows: Record<string, string>[]): Promise<{ success: number; failed: number; errors: string[] }> {
  const errors: string[] = []
  const validRows: Array<Record<string, unknown>> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    if (!row['Customer Code']) { errors.push(`Row ${rowNum}: Customer Code is required`); continue }
    if (!row['Customer Name']) { errors.push(`Row ${rowNum}: Customer Name is required`); continue }
    validRows.push({
      customerCode: row['Customer Code'],
      name: row['Customer Name'],
      contactPerson: row['Contact Person'] || null,
      email: row['Email'] || null,
      phone: row['Phone'] || null,
      address: row['Address'] || null,
      city: row['City'] || null,
      country: row['Country'] || null,
      taxId: row['Tax ID'] || null,
      creditLimit: parseFloat(row['Credit Limit'] ?? '0') || 0,
      paymentTerms: parseInt(row['Payment Terms (Days)'] ?? '30') || 30,
    })
  }

  let success = 0
  for (let i = 0; i < validRows.length; i += 100) {
    const chunk = validRows.slice(i, i + 100)
    try {
      await prisma.customer.createMany({ data: chunk as any })
      success += chunk.length
    } catch {
      for (const row of chunk) {
        try {
          await prisma.customer.create({ data: row as any })
          success++
        } catch (e2) {
          errors.push(`Row ${rows.findIndex(r => r['Customer Code'] === (row as any).customerCode) + 2}: ${(e2 as Error).message.split('\n')[0]}`)
        }
      }
    }
  }

  return { success, failed: rows.length - success, errors }
}

// ── Customer Anonymise ────────────────────────────────────────────────────

export async function anonymiseCustomer(id: string, userId: string) {
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: 'ANONYMISED',
      email: `anon-${id}@deleted.invalid`,
      phone: null,
      address: null,
      contactPerson: null,
      taxId: null,
      isActive: false,
      deletedAt: new Date(),
    },
    select: { id: true, email: true, deletedAt: true },
  })

  await prisma.crmContact.updateMany({
    where: { customerId: id, deletedAt: null },
    data: { firstName: 'ANONYMISED', lastName: 'ANONYMISED', email: null, phone: null, deletedAt: new Date() },
  })

  await prisma.auditLog.create({
    data: { userId, action: 'GDPR_ANONYMISE', entity: 'Customer', entityId: id, newValues: { isAnonymised: true } },
  })

  return customer
}

// ── Credit Check ──────────────────────────────────────────────────────────

export async function performCreditCheck(order: {
  id: string
  customerId: string
  totalAmount: number | { toString(): string }
  customer: { creditLimit: number | { toString(): string } | null }
}) {
  const creditLimit = Number(order.customer.creditLimit ?? 0)

  if (creditLimit === 0) {
    await prisma.salesOrder.update({ where: { id: order.id }, data: { status: 'PICKING' } })
    return { approved: true, status: 'PICKING' as const, reason: 'No credit limit set', creditLimit: 0 }
  }

  const outstanding = await prisma.customerInvoice.aggregate({
    where: { customerId: order.customerId, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
    _sum: { totalAmount: true },
  })
  const outstandingAmount = Number(outstanding._sum.totalAmount ?? 0)
  const orderTotal = Number(order.totalAmount)
  const totalExposure = outstandingAmount + orderTotal
  const approved = totalExposure <= creditLimit

  await prisma.salesOrder.update({
    where: { id: order.id },
    data: { status: approved ? 'PICKING' : 'CREDIT_HOLD' },
  })

  return { approved, status: approved ? 'PICKING' as const : 'CREDIT_HOLD' as const, creditLimit, outstandingAmount, orderTotal, totalExposure }
}

// ── Sales Order Status Updates ────────────────────────────────────────────

export function updateSalesOrderStatus(id: string, status: string) {
  return prisma.salesOrder.update({ where: { id }, data: { status: status as any } })
}