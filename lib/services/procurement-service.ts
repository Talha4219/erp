import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { calcLineTotal, calcOrderTotals, round2 } from '@/lib/money'
import { nextDocNumber } from '@/lib/services/numbering'
import { nextSupplierQuotationNumber, nextVendorInvoiceNumber, nextPurchaseOrderNumber } from '@/lib/codes'
import { createJournalEntry, findAccount } from '@/lib/services/accounting'

// ── Purchase Orders ──────────────────────────────────────────────────────

const poIncludes = {
  vendor: { select: { id: true, name: true, vendorCode: true } },
  lineItems: true,
} as const

const poDetailIncludes = {
  vendor: true,
  lineItems: { include: { item: true } },
  pr: { select: { id: true, prNumber: true } },
  _count: { select: { grns: true, vendorInvoices: true } },
} as const

type POLineInput = { description?: string; uom?: string; quantity: number; unitPrice: number; discount?: number; taxRate?: number }

export function processPOLineItems(lineItems: POLineInput[]) {
  const lineCalcs = lineItems.map((li) => calcLineTotal({
    quantity: li.quantity, unitPrice: li.unitPrice, taxRate: li.taxRate,
  }))
  const processedItems = lineItems.map((li, i) => ({
    description: li.description ?? '',
    uom: li.uom ?? '',
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    discount: li.discount ?? 0,
    taxRate: li.taxRate ?? 0,
    totalPrice: lineCalcs[i].grossTotal,
  }))
  const { totalTax: taxAmount, grandTotal: totalAmount } = calcOrderTotals(lineCalcs)
  return { lineCalcs, processedItems, taxAmount, totalAmount }
}

export async function createPurchaseOrder(
  tx: Prisma.TransactionClient,
  data: {
    vendorId: string
    orderDate: Date
    deliveryDate?: Date | null
    shippingCost?: number
    notes?: string | null
    lineItems: POLineInput[]
    companyId?: string | null
    prId?: string | null
    sqId?: string | null
  },
) {
  const poNumber = await nextDocNumber('purchase_order')
  const { processedItems, taxAmount, totalAmount } = processPOLineItems(data.lineItems)
  const shippingCost = round2(Number(data.shippingCost ?? 0))
  const grandTotal = round2(totalAmount + shippingCost)

  const po = await tx.purchaseOrder.create({
    data: {
      poNumber,
      vendorId: data.vendorId,
      companyId: data.companyId ?? undefined,
      prId: data.prId ?? undefined,
      sqId: data.sqId ?? undefined,
      orderDate: data.orderDate,
      deliveryDate: data.deliveryDate ?? undefined,
      notes: data.notes ?? undefined,
      totalAmount,
      taxAmount,
      shippingCost,
      grandTotal,
      lineItems: processedItems.length > 0 ? { create: processedItems } : undefined,
    },
    include: poIncludes,
  })

  return { po, poNumber, grandTotal }
}

export function listPurchaseOrders(companyId?: string | null) {
  return prisma.purchaseOrder.findMany({
    where: { deletedAt: null, ...(companyId ? { companyId } : {}) },
    include: poIncludes,
    orderBy: { orderDate: 'desc' },
    take: 100,
  })
}

export function getPurchaseOrder(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: poDetailIncludes,
  })
}

export async function updatePurchaseOrderStatus(
  tx: Prisma.TransactionClient,
  id: string,
  status: string, // validated by caller against POStatus enum
  metadata: { poNumber: string; vendorId: string; grandTotal: number; userId: string },
) {
  const po = await tx.purchaseOrder.update({ where: { id }, data: { status: status as any } })
  if (status === 'APPROVED') {
    const { eventBus } = await import('@/lib/events/bus')
    await eventBus.emit('po.approved', {
      poId: id, poNumber: metadata.poNumber,
      vendorId: metadata.vendorId, grandTotal: metadata.grandTotal, userId: metadata.userId,
    }).catch(() => {})
  }
  return po
}

export function softDeletePurchaseOrder(id: string) {
  return prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'CANCELLED', deletedAt: new Date() },
  })
}

// ── Supplier Quotations ──────────────────────────────────────────────────

const sqIncludes = {
  vendor: { select: { name: true } },
  rfq: { select: { rfqNumber: true } },
  purchaseOrder: { select: { poNumber: true } },
} as const

export function listSupplierQuotations() {
  return prisma.supplierQuotation.findMany({
    where: { deletedAt: null },
    include: sqIncludes,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

interface SQLineInput {
  unitPrice: number
  quantity: number
  taxRate?: number
  description: string
  uom?: string
}

export async function createSupplierQuotation(data: {
  vendorId: string
  rfqId?: string | null
  quotationDate: Date
  validUntil: Date
  currency?: string
  notes?: string | null
  lineItems: SQLineInput[]
}) {
  const sqNumber = await nextSupplierQuotationNumber()
  const lineCalcs = data.lineItems.map((i) => calcLineTotal({
    quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), taxRate: i.taxRate,
  }))
  const totalAmount = lineCalcs.reduce((s, c) => s + c.grossTotal, 0)

  return prisma.supplierQuotation.create({
    data: {
      sqNumber,
      vendorId: data.vendorId,
      rfqId: data.rfqId ?? undefined,
      quotationDate: data.quotationDate,
      validUntil: data.validUntil,
      currency: data.currency ?? 'GBP',
      totalAmount,
      notes: data.notes ?? undefined,
      lineItems: data.lineItems.length ? {
        createMany: {
          data: data.lineItems.map((i, idx) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            uom: i.uom ?? undefined,
            taxRate: i.taxRate ?? 0,
            totalPrice: lineCalcs[idx].grossTotal,
          })),
        },
      } : undefined,
    },
    include: { lineItems: true },
  })
}

export function getSupplierQuotation(id: string) {
  return prisma.supplierQuotation.findUnique({
    where: { id },
    include: {
      vendor: true,
      rfq: { include: { lineItems: true } },
      lineItems: true,
      purchaseOrder: { select: { id: true, poNumber: true, status: true } },
    },
  })
}

export async function convertQuotationToPO(
  tx: Prisma.TransactionClient,
  sq: {
    id: string
    vendorId: string
    totalAmount: number | Prisma.Decimal
    lineItems: Array<{
      description: string
      quantity: number | Prisma.Decimal
      uom: string | null
      unitPrice: number | Prisma.Decimal
      taxRate: number | Prisma.Decimal
      totalPrice: number | Prisma.Decimal
      [k: string]: unknown
    }>
  },
) {
  const poNumber = await nextPurchaseOrderNumber()
  const po = await tx.purchaseOrder.create({
    data: {
      poNumber,
      sqId: sq.id,
      vendorId: sq.vendorId,
      orderDate: new Date(),
      totalAmount: Number(sq.totalAmount),
      taxAmount: 0,
      shippingCost: 0,
      grandTotal: Number(sq.totalAmount),
      lineItems: sq.lineItems.length ? {
        createMany: {
          data: sq.lineItems.map((i) => ({
            description: i.description,
            quantity: Number(i.quantity),
            uom: i.uom ?? '',
            unitPrice: Number(i.unitPrice),
            taxRate: Number(i.taxRate),
            totalPrice: Number(i.totalPrice),
          })),
        },
      } : undefined,
    },
  })
  await tx.supplierQuotation.update({ where: { id: sq.id }, data: { status: 'ACCEPTED' } })
  return po
}

// ── Vendor Invoices ──────────────────────────────────────────────────────

interface VILineInput {
  itemId?: string
  description: string
  quantity: number
  unitPrice: number
  taxRate?: number
  discount?: number
  glAccountId?: string
  warehouseId?: string
  costCentreId?: string
  projectId?: string
}

export function processVILineItems(items: VILineInput[]) {
  const lineCalcs = items.map((it) => calcLineTotal({
    quantity: Number(it.quantity ?? 1), unitPrice: Number(it.unitPrice ?? 0),
    discountPct: Number(it.discount ?? 0), taxRate: Number(it.taxRate ?? 0),
  }))
  const lineItemsData = items.map((it, i) => ({
    itemId: it.itemId || undefined,
    description: it.description,
    quantity: Number(it.quantity ?? 1),
    unitPrice: Number(it.unitPrice ?? 0),
    taxRate: Number(it.taxRate ?? 0),
    discount: Number(it.discount ?? 0),
    totalPrice: lineCalcs[i].grossTotal,
    glAccountId: it.glAccountId || undefined,
    warehouseId: it.warehouseId || undefined,
    costCentreId: it.costCentreId || undefined,
    projectId: it.projectId || undefined,
  }))
  const { subTotal, totalTax: taxAmount, totalDiscount: lineDiscount } = calcOrderTotals(lineCalcs)
  return { lineCalcs, lineItemsData, subTotal, taxAmount, lineDiscount }
}

export async function createVendorInvoice(
  tx: Prisma.TransactionClient,
  data: {
    vendorId: string
    invoiceDate: Date
    dueDate: Date
    poId?: string | null
    notes?: string | null
    currencyCode?: string | null
    exchangeRate?: number | null
    departmentId?: string | null
    costCentreId?: string | null
    shippingCharges?: number | null
    headerDiscount?: number | null
    items: VILineInput[]
  },
) {
  const invoiceNumber = await nextVendorInvoiceNumber()

  if (data.items.length === 0) {
    throw new Error('At least one line item is required')
  }

  const { lineItemsData, subTotal, taxAmount, lineDiscount } = processVILineItems(data.items)
  const shipping = round2(Number(data.shippingCharges ?? 0))
  const discountAmount = round2(Number(data.headerDiscount ?? lineDiscount))
  const totalAmount = round2(subTotal + taxAmount + shipping - discountAmount)

  let matchingStatus: 'PENDING' | 'MATCHED' | 'MISMATCH' = 'PENDING'
  if (data.poId) {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: data.poId },
      select: { grandTotal: true },
    })
    if (po) matchingStatus = Math.abs(Number(po.grandTotal) - totalAmount) < 0.01 ? 'MATCHED' : 'MISMATCH'
  }

  const inv = await tx.vendorInvoice.create({
    data: {
      invoiceNumber,
      vendorId: data.vendorId,
      poId: data.poId ?? undefined,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      subTotal,
      taxAmount,
      shippingCharges: shipping,
      discountAmount,
      totalAmount,
      matchingStatus,
      notes: data.notes ?? undefined,
      currencyCode: data.currencyCode ?? undefined,
      exchangeRate: data.exchangeRate ?? undefined,
      departmentId: data.departmentId ?? undefined,
      costCentreId: data.costCentreId ?? undefined,
      items: { create: lineItemsData },
    },
    include: { items: true },
  })

  return { inv, totalAmount }
}

export const viListIncludes = {
  vendor: { select: { name: true } },
  po: { select: { poNumber: true } },
  department: { select: { name: true } },
  _count: { select: { items: true } },
} as const

export function listVendorInvoices() {
  return prisma.vendorInvoice.findMany({
    where: { deletedAt: null },
    include: viListIncludes,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function getVendorInvoice(id: string) {
  const inv = await prisma.vendorInvoice.findUnique({
    where: { id },
    include: {
      vendor: true,
      po: { include: { lineItems: true, grns: { include: { lineItems: true } } } },
      department: { select: { id: true, name: true } },
      costCentre: { select: { id: true, name: true } },
      items: {
        include: {
          item: { select: { name: true, sku: true } },
          glAccount: { select: { code: true, name: true } },
          warehouse: { select: { name: true } },
          costCentre: { select: { name: true } },
          project: { select: { name: true } },
        },
      },
      payments: { orderBy: { paymentDate: 'desc' } },
    },
  })
  if (!inv) return null

  const [ratingAgg, outstandingAgg, journalEntries] = await Promise.all([
    prisma.supplierRating.aggregate({ where: { vendorId: inv.vendorId }, _avg: { overallScore: true } }),
    prisma.vendorInvoice.aggregate({
      where: { vendorId: inv.vendorId, deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.journalEntry.findMany({
      where: {
        deletedAt: null,
        reference: { in: [`VINV:${id}`, ...inv.payments.map((p) => `VPAY:${p.id}`)] },
      },
      include: {
        lines: {
          include: {
            debitAccount: { select: { code: true, name: true } },
            creditAccount: { select: { code: true, name: true } },
            costCentre: { select: { name: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    }),
  ])

  const vendorOutstanding = Number(outstandingAgg._sum.totalAmount ?? 0) - Number(outstandingAgg._sum.paidAmount ?? 0)

  return {
    ...inv,
    vendorRating: ratingAgg._avg.overallScore,
    vendorOutstandingBalance: vendorOutstanding,
    journalEntries,
  }
}

export async function postVendorInvoiceAPJournal(
  tx: Prisma.TransactionClient,
  invoice: { id: string; invoiceNumber: string; totalAmount: number },
  userId: string,
) {
  const existing = await tx.journalEntry.findFirst({ where: { reference: `VINV:${invoice.id}` } })
  if (existing) return

  const [expenseAcc, apAcc] = await Promise.all([
    findAccount(tx, '1130'),
    findAccount(tx, '2000'),
  ])
  if (!expenseAcc || !apAcc) return

  await createJournalEntry(tx, {
    description: `Supplier invoice ${invoice.invoiceNumber} — AP liability`,
    date: new Date(),
    reference: `VINV:${invoice.id}`,
    createdById: userId,
    lines: [
      { debitAccountId: expenseAcc.id, debitAmount: invoice.totalAmount, description: 'Goods/services received' },
      { creditAccountId: apAcc.id, creditAmount: invoice.totalAmount, description: 'Accounts payable booked' },
    ],
  })
}

// ── Purchase Returns ─────────────────────────────────────────────────────

export function getPurchaseReturn(id: string) {
  return prisma.purchaseReturn.findUnique({
    where: { id },
    include: { vendor: true, grn: true, invoice: true, lineItems: true },
  })
}

export async function updatePurchaseReturnStatus(
  tx: Prisma.TransactionClient,
  id: string,
  status: string,
  current: {
    status: string
    returnNumber: string
    lineItems: Array<{ itemId: string | null; warehouseId: string | null; quantity: number | Prisma.Decimal; unitPrice: number | Prisma.Decimal }>
  },
) {
  const updated = await tx.purchaseReturn.update({ where: { id }, data: { status: status as any } })
  if (status === 'SHIPPED' && current.status !== 'SHIPPED') {
    const today = new Date()
    const shipLines = current.lineItems.filter(
      (li): li is typeof li & { itemId: string; warehouseId: string } =>
        !!li.itemId && !!li.warehouseId && Number(li.quantity) > 0,
    )
    for (const li of shipLines) {
      const { decrementStock } = await import('@/lib/stock')
      await decrementStock(tx, li.itemId, li.warehouseId, Number(li.quantity), {
        unitCost: Number(li.unitPrice),
        referenceType: 'PURCHASE_RETURN', referenceId: id,
        notes: `Purchase return ${current.returnNumber}`, transactionDate: today,
      })
    }
  }
  return updated
}

export function softDeletePurchaseReturn(id: string) {
  return prisma.purchaseReturn.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Purchase Order field updates ─────────────────────────────────────────

export function updatePurchaseOrder(id: string, data: Record<string, unknown>) {
  return prisma.purchaseOrder.update({ where: { id }, data: data as any })
}

// ── Supplier Quotation field update ──────────────────────────────────────

export function updateSupplierQuotation(id: string, data: Record<string, unknown>) {
  return prisma.supplierQuotation.update({ where: { id }, data: data as any })
}

export function softDeleteSupplierQuotation(id: string) {
  return prisma.supplierQuotation.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Vendor Invoice field update / soft delete ────────────────────────────

export function updateVendorInvoice(id: string, data: Record<string, unknown>) {
  return prisma.vendorInvoice.update({ where: { id }, data: data as any })
}

export function softDeleteVendorInvoice(id: string) {
  return prisma.vendorInvoice.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Vendors ──────────────────────────────────────────────────────────────

export function listVendors(search?: string) {
  return prisma.vendor.findMany({
    where: {
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    },
    select: {
      id: true, name: true, vendorCode: true, email: true, phone: true,
      contactPerson: true, taxId: true, address: true, city: true, country: true,
      isActive: true, createdAt: true,
    },
    orderBy: { name: 'asc' },
    take: 100,
  })
}

const vendorDetailSelect = {
  id: true, name: true, vendorCode: true, email: true, phone: true,
  contactPerson: true, taxId: true, address: true, city: true, country: true,
  isActive: true, createdAt: true, updatedAt: true,
  contacts: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: 'desc' as const }, { firstName: 'asc' as const }],
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, jobTitle: true, isPrimary: true },
  },
  ratings: { orderBy: { ratedAt: 'desc' as const }, take: 20 },
  purchaseOrders: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
    take: 20,
    select: { id: true, poNumber: true, status: true, grandTotal: true, orderDate: true, deliveryDate: true },
  },
}

export function getVendor(id: string) {
  return prisma.vendor.findUnique({ where: { id }, select: vendorDetailSelect })
}

export function createVendor(data: Record<string, unknown>) {
  return prisma.vendor.create({
    data: data as any,
    select: {
      id: true, name: true, vendorCode: true, email: true, phone: true,
      contactPerson: true, taxId: true, address: true, city: true, country: true,
      isActive: true, createdAt: true,
    },
  })
}

const vendorAllowedFields = ['name', 'vendorCode', 'contactPerson', 'email', 'phone', 'address', 'city', 'country', 'taxId', 'paymentTerms', 'creditLimit', 'isActive'] as const

export function sanitizeVendorInput(body: Record<string, unknown>): Record<string, unknown> {
  const allowed: Record<string, unknown> = {}
  for (const f of vendorAllowedFields) {
    if (body[f] !== undefined) allowed[f] = body[f]
  }
  if (body.creditLimit !== undefined) allowed.creditLimit = Number(body.creditLimit)
  if (body.paymentTerms !== undefined) allowed.paymentTerms = Number(body.paymentTerms)
  return allowed
}

export function updateVendor(id: string, data: Record<string, unknown>) {
  return prisma.vendor.update({
    where: { id },
    data,
    select: {
      id: true, name: true, vendorCode: true, email: true, phone: true,
      contactPerson: true, taxId: true, address: true, city: true, country: true,
      isActive: true, createdAt: true, updatedAt: true,
    },
  })
}

export function softDeleteVendor(id: string) {
  return prisma.vendor.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
  })
}

// ── Purchase Requisitions ─────────────────────────────────────────────────

export function listPurchaseRequests() {
  return prisma.purchaseRequisition.findMany({
    where: { deletedAt: null },
    include: { vendor: { select: { name: true } }, lineItems: true, _count: { select: { rfqs: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function createPurchaseRequest(data: {
  requestedById: string
  vendorId?: string | null
  department?: string | null
  requiredDate: Date
  notes?: string | null
  priority?: string
  lineItems?: Array<{ description: string; uom?: string; quantity: number; estimatedUnitPrice: number }>
  submitForApproval?: boolean
}) {
  const prNumber = await import('@/lib/codes').then(m => m.nextPurchaseRequestNumber())
  const totalAmount = (data.lineItems ?? []).reduce((s, i) => s + Number(i.estimatedUnitPrice) * Number(i.quantity), 0)
  const status = data.submitForApproval ? 'PENDING' : 'DRAFT'
  const pr = await prisma.purchaseRequisition.create({
    data: {
      prNumber,
      requestedById: data.requestedById,
      vendorId: data.vendorId ?? undefined,
      department: data.department ?? null,
      requiredDate: data.requiredDate,
      notes: data.notes ?? null,
      priority: data.priority ?? 'MEDIUM',
      status,
      totalAmount,
      lineItems: data.lineItems?.length ? {
        createMany: {
          data: data.lineItems.map(i => ({
            description: i.description,
            uom: i.uom ?? 'EA',
            quantity: i.quantity,
            estimatedUnitPrice: i.estimatedUnitPrice,
            totalPrice: i.estimatedUnitPrice * i.quantity,
          })),
        },
      } : undefined,
    },
    include: { lineItems: true },
  })
  if (data.submitForApproval) {
    const { eventBus } = await import('@/lib/events/bus')
    eventBus.emit('pr.submitted', {
      prId: pr.id, prNumber: pr.prNumber, requestedById: pr.requestedById, department: pr.department, totalAmount,
    }).catch(() => {})
  }
  return pr
}

export function getPurchaseRequest(id: string) {
  return prisma.purchaseRequisition.findUnique({
    where: { id },
    include: { vendor: true, lineItems: true, purchaseOrder: { select: { id: true, poNumber: true, status: true } }, rfqs: { select: { id: true, rfqNumber: true, status: true } } },
  })
}

export async function updatePurchaseRequest(id: string, data: Record<string, unknown>, sessionUser?: { id: string }) {
  const { status, ...rest } = data
  const current = await prisma.purchaseRequisition.findUnique({
    where: { id },
    select: { status: true, requestedById: true, prNumber: true, department: true, totalAmount: true },
  })
  if (!current) throw new Error('Not found')

  const updated = await prisma.purchaseRequisition.update({
    where: { id },
    data: { ...(status ? { status: status as any } : {}), ...rest },
  })

  if (status && status !== current.status && sessionUser) {
    const { eventBus } = await import('@/lib/events/bus')
    if (status === 'PENDING') {
      eventBus.emit('pr.submitted', { prId: id, prNumber: current.prNumber, requestedById: current.requestedById, department: current.department, totalAmount: Number(current.totalAmount) }).catch(() => {})
    }
    if (status === 'APPROVED') {
      eventBus.emit('pr.approved', { prId: id, prNumber: current.prNumber, requestedById: current.requestedById, approverId: sessionUser.id }).catch(() => {})
    }
    if (status === 'REJECTED') {
      eventBus.emit('pr.rejected', { prId: id, prNumber: current.prNumber, requestedById: current.requestedById, approverId: sessionUser.id, reason: (data as any).rejectionReason }).catch(() => {})
    }
  }
  return updated
}

export function softDeletePurchaseRequest(id: string) {
  return prisma.purchaseRequisition.update({ where: { id }, data: { deletedAt: new Date(), status: 'REJECTED' } })
}

// ── Approvals ─────────────────────────────────────────────────────────────

export async function getApprovals() {
  const [pendingPRs, pendingPOs, historyPRs, historyPOs] = await Promise.all([
    prisma.purchaseRequisition.findMany({
      where: { deletedAt: null, status: 'PENDING' },
      include: { lineItems: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.purchaseOrder.findMany({
      where: { deletedAt: null, status: 'PENDING_APPROVAL' },
      include: { vendor: { select: { name: true } }, lineItems: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.purchaseRequisition.findMany({
      where: { deletedAt: null, status: { in: ['APPROVED', 'REJECTED'] } },
      include: { lineItems: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.purchaseOrder.findMany({
      where: { deletedAt: null, status: { in: ['APPROVED', 'CANCELLED'] } },
      include: { vendor: { select: { name: true } }, lineItems: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
  ])
  return { pending: { prs: pendingPRs, pos: pendingPOs }, history: { prs: historyPRs, pos: historyPOs } }
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export async function getProcurementDashboard() {
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalVendors, openPOs, openPRs, pendingGRNs, pendingApprovalsRes, unpaidInvoicesRes, overdueInvoicesRes,
    recentPOs, pendingReturns, monthlyOrders, topSupplierRows, recentPRs, recentGRNs,
    draftPRs, pendingPRsCount, approvedPRsCount, pendingApprovalPOsCount, approvedPOsCount,
    partialGRNs, fullyReceivedPOs, overdueDeliveries, completedPOs,
  ] = await Promise.all([
    prisma.vendor.count({ where: { deletedAt: null, isActive: true } }),
    prisma.purchaseOrder.count({ where: { deletedAt: null, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED'] } } }),
    prisma.purchaseRequisition.count({ where: { deletedAt: null, status: { in: ['DRAFT', 'PENDING', 'APPROVED'] } } }),
    prisma.purchaseOrder.count({ where: { deletedAt: null, status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } } }),
    Promise.all([
      prisma.purchaseRequisition.count({ where: { deletedAt: null, status: 'PENDING' } }),
      prisma.purchaseOrder.count({ where: { deletedAt: null, status: 'PENDING_APPROVAL' } }),
    ]).then(([pr, po]) => pr + po),
    prisma.vendorInvoice.aggregate({ where: { deletedAt: null, status: { in: ['DRAFT', 'SENT', 'PARTIALLY_PAID'] } }, _sum: { totalAmount: true, paidAmount: true }, _count: { id: true } }),
    prisma.vendorInvoice.aggregate({ where: { deletedAt: null, status: { in: ['SENT', 'PARTIALLY_PAID'] }, dueDate: { lt: now } }, _sum: { totalAmount: true }, _count: { id: true } }),
    prisma.purchaseOrder.findMany({ where: { deletedAt: null }, include: { vendor: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.purchaseReturn.count({ where: { deletedAt: null, status: { in: ['DRAFT', 'APPROVED'] } } }),
    prisma.purchaseOrder.findMany({ where: { deletedAt: null, status: { not: 'CANCELLED' }, orderDate: { gte: sixMonthsAgo } }, select: { orderDate: true, grandTotal: true } }),
    prisma.purchaseOrder.groupBy({ by: ['vendorId'], where: { deletedAt: null, status: { not: 'CANCELLED' } }, _sum: { grandTotal: true }, _count: { id: true }, orderBy: { _sum: { grandTotal: 'desc' } }, take: 5 }),
    prisma.purchaseRequisition.findMany({ where: { deletedAt: null }, select: { id: true, prNumber: true, status: true, createdAt: true, department: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.goodsReceiptNote.findMany({ where: {}, select: { id: true, grnNumber: true, receivedDate: true, createdAt: true, po: { select: { vendor: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.purchaseRequisition.count({ where: { deletedAt: null, status: 'DRAFT' } }),
    prisma.purchaseRequisition.count({ where: { deletedAt: null, status: 'PENDING' } }),
    prisma.purchaseRequisition.count({ where: { deletedAt: null, status: 'APPROVED' } }),
    prisma.purchaseOrder.count({ where: { deletedAt: null, status: 'PENDING_APPROVAL' } }),
    prisma.purchaseOrder.count({ where: { deletedAt: null, status: 'APPROVED' } }),
    prisma.purchaseOrder.count({ where: { deletedAt: null, status: 'PARTIALLY_RECEIVED' } }),
    prisma.purchaseOrder.count({ where: { deletedAt: null, status: 'FULLY_RECEIVED' } }),
    prisma.purchaseOrder.count({ where: { deletedAt: null, status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] }, orderDate: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.purchaseOrder.findMany({ where: { deletedAt: null, status: 'FULLY_RECEIVED', pr: { isNot: null } }, select: { createdAt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 20 }),
  ])

  const [rfqCount, quotationCount, grnCount, invoiceCount, paymentCount, supplierRatingRows] = await Promise.all([
    prisma.rfq.count({ where: { deletedAt: null } }),
    prisma.supplierQuotation.count({ where: { deletedAt: null } }),
    prisma.goodsReceiptNote.count(),
    prisma.vendorInvoice.count({ where: { deletedAt: null } }),
    prisma.vendorPayment.count(),
    prisma.supplierRating.groupBy({ by: ['vendorId'], _avg: { overallScore: true }, orderBy: { _avg: { overallScore: 'desc' } }, take: 5 }),
  ])

  const totalPRsAllTime = await prisma.purchaseRequisition.count({ where: { deletedAt: null } })
  const totalPOsAllTime = await prisma.purchaseOrder.count({ where: { deletedAt: null, status: { not: 'CANCELLED' } } })

  const funnel = [
    { stage: 'Purchase Requests', count: totalPRsAllTime, color: '#8b5cf6' },
    { stage: 'RFQs', count: rfqCount, color: '#6366f1' },
    { stage: 'Quotations', count: quotationCount, color: '#3b82f6' },
    { stage: 'Purchase Orders', count: totalPOsAllTime, color: '#0ea5e9' },
    { stage: 'GRNs', count: grnCount, color: '#10b981' },
    { stage: 'Invoices', count: invoiceCount, color: '#22c55e' },
    { stage: 'Payments', count: paymentCount, color: '#84cc16' },
  ]

  const ratedVendorIds = supplierRatingRows.map(r => r.vendorId)
  const ratedVendors = ratedVendorIds.length ? await prisma.vendor.findMany({ where: { id: { in: ratedVendorIds } }, select: { id: true, name: true } }) : []
  const ratedVendorMap = Object.fromEntries(ratedVendors.map(v => [v.id, v.name]))
  const supplierPerformance = supplierRatingRows.map(r => ({ name: ratedVendorMap[r.vendorId] ?? 'Unknown', score: Math.round(Number(r._avg.overallScore ?? 0) * 20) }))

  const totalUnpaid = Number(unpaidInvoicesRes._sum.totalAmount ?? 0) - Number(unpaidInvoicesRes._sum.paidAmount ?? 0)

  const byMonth: Record<string, number> = {}
  for (const o of monthlyOrders) {
    const key = `${o.orderDate.getFullYear()}-${String(o.orderDate.getMonth() + 1).padStart(2, '0')}`
    byMonth[key] = (byMonth[key] ?? 0) + Number(o.grandTotal)
  }
  const monthlySpend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { month: key, total: byMonth[key] ?? 0 }
  })

  const thisMonthSpend = monthlyOrders.filter(o => o.orderDate >= monthStart).reduce((s, o) => s + Number(o.grandTotal), 0)

  const vendorIds = topSupplierRows.map(r => r.vendorId)
  const vendors = await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } })
  const vendorMap = Object.fromEntries(vendors.map(v => [v.id, v]))
  const topSuppliers = topSupplierRows.map(r => ({ name: vendorMap[r.vendorId]?.name ?? 'Unknown', totalSpend: Number(r._sum.grandTotal ?? 0), poCount: r._count.id }))

  const activities = [
    ...recentPRs.map(p => ({ type: 'PR' as const, id: p.id, ref: p.prNumber, status: p.status, label: p.department ?? 'Purchase Request', date: p.createdAt })),
    ...recentPOs.map(p => ({ type: 'PO' as const, id: p.id, ref: (p as any).poNumber, status: p.status, label: (p as any).vendor?.name ?? '', date: p.createdAt })),
    ...recentGRNs.map(g => ({ type: 'GRN' as const, id: g.id, ref: g.grnNumber, status: 'RECEIVED', label: (g.po as any)?.vendor?.name ?? '', date: g.createdAt })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

  const avgCycleTimeDays = completedPOs.length > 0
    ? Math.round(completedPOs.reduce((s, po) => s + (po.updatedAt.getTime() - po.createdAt.getTime()), 0) / completedPOs.length / (86400 * 1000))
    : null

  const pipeline = [
    { stage: 'PR Draft', key: 'pr_draft', count: draftPRs, color: 'bg-gray-400', href: '/procurement/purchase-requests' },
    { stage: 'Awaiting Approval', key: 'pr_pending', count: pendingPRsCount + pendingApprovalPOsCount, color: 'bg-amber-500', href: '/procurement/approval-center' },
    { stage: 'Approved — No PO', key: 'pr_approved', count: approvedPRsCount, color: 'bg-blue-500', href: '/procurement/purchase-requests' },
    { stage: 'PO Pending Approval', key: 'po_pending', count: pendingApprovalPOsCount, color: 'bg-orange-500', href: '/procurement/purchase-orders' },
    { stage: 'PO Approved', key: 'po_approved', count: approvedPOsCount, color: 'bg-indigo-500', href: '/procurement/purchase-orders' },
    { stage: 'Awaiting GRN', key: 'awaiting_grn', count: pendingGRNs, color: 'bg-teal-500', href: '/procurement/goods-receipt' },
    { stage: 'Partially Received', key: 'partial_grn', count: partialGRNs, color: 'bg-violet-500', href: '/procurement/goods-receipt' },
    { stage: 'Unpaid Invoices', key: 'unpaid_inv', count: unpaidInvoicesRes._count.id, color: 'bg-red-500', href: '/procurement/purchase-invoices' },
  ]

  return {
    totalVendors, openPOs, openPRs, pendingGRNs, totalUnpaid, pendingApprovals: pendingApprovalsRes,
    thisMonthSpend, recentPOs, pendingReturns, monthlySpend, topSuppliers, activities,
    pipeline,
    overdueInvoices: { count: overdueInvoicesRes._count.id, total: Number(overdueInvoicesRes._sum.totalAmount ?? 0) },
    overdueDeliveries,
    avgCycleTimeDays,
    fullyReceivedThisMonth: fullyReceivedPOs,
    funnel,
    supplierPerformance,
  }
}

// ── GRN ───────────────────────────────────────────────────────────────────

export function getGRN(id: string) {
  return prisma.goodsReceiptNote.findUnique({
    where: { id },
    include: { po: { include: { vendor: true, lineItems: { include: { item: true } } } }, lineItems: true },
  })
}

export async function getGRNAnalytics(companyId?: string | null) {
  const scope = companyId ? { po: { companyId } } : {}
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [grns, pendingGRNsCount, poStatusCounts] = await Promise.all([
    prisma.goodsReceiptNote.findMany({
      where: scope as any,
      include: { lineItems: { select: { acceptedQty: true, rejectedQty: true, unitPrice: true } }, po: { select: { vendor: { select: { name: true } } } } },
      orderBy: { receivedDate: 'desc' },
    }),
    prisma.purchaseOrder.count({ where: { ...(companyId ? { companyId } : {}), status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] }, deletedAt: null } }),
    prisma.purchaseOrder.groupBy({ by: ['status'], where: { ...(companyId ? { companyId } : {}), deletedAt: null }, _count: { id: true } }),
  ])

  const todayCount = grns.filter(g => new Date(g.receivedDate) >= todayStart).length
  let totalAccepted = 0, totalRejected = 0, receivingValue = 0
  grns.forEach(g => g.lineItems.forEach(li => {
    totalAccepted += Number(li.acceptedQty)
    totalRejected += Number(li.rejectedQty)
    receivingValue += Number(li.acceptedQty) * Number(li.unitPrice)
  }))

  const dailyMap: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * 86_400_000)
    dailyMap[d.toISOString().split('T')[0]] = 0
  }
  grns.forEach(g => {
    const day = new Date(g.receivedDate).toISOString().split('T')[0]
    if (day in dailyMap) {
      dailyMap[day] += g.lineItems.reduce((s, li) => s + Number(li.acceptedQty) * Number(li.unitPrice), 0)
    }
  })
  const dailyTrend = Object.entries(dailyMap).map(([date, value]) => ({
    day: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' }), date, value,
  }))

  const statusMap = Object.fromEntries(poStatusCounts.map(r => [r.status, r._count.id]))
  const statusDist = [
    { label: 'Completed', count: statusMap['FULLY_RECEIVED'] ?? 0, cls: 'bg-emerald-500' },
    { label: 'Pending', count: statusMap['APPROVED'] ?? 0, cls: 'bg-amber-400' },
    { label: 'Partial', count: statusMap['PARTIALLY_RECEIVED'] ?? 0, cls: 'bg-blue-500' },
    { label: 'Cancelled', count: statusMap['CANCELLED'] ?? 0, cls: 'bg-red-400' },
  ]

  const supplierMap: Record<string, { name: string; accepted: number; rejected: number }> = {}
  grns.forEach(g => {
    const name = g.po.vendor.name
    if (!supplierMap[name]) supplierMap[name] = { name, accepted: 0, rejected: 0 }
    g.lineItems.forEach(li => {
      supplierMap[name].accepted += Number(li.acceptedQty)
      supplierMap[name].rejected += Number(li.rejectedQty)
    })
  })
  const supplierQuality = Object.values(supplierMap).filter(s => s.accepted + s.rejected > 0)
    .sort((a, b) => (b.accepted + b.rejected) - (a.accepted + a.rejected)).slice(0, 5)

  return {
    kpis: { todayCount, totalItemsReceived: totalAccepted, pendingGRNs: pendingGRNsCount, rejectedItems: totalRejected, receivingValue },
    dailyTrend, statusDist, supplierQuality,
  }
}

// ── Reports ───────────────────────────────────────────────────────────────

export async function getProcurementReports() {
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [topSuppliersBySpend, poStatusBreakdown, monthlySpendData, supplierAvgRatings, invoicePaymentStats] = await Promise.all([
    prisma.purchaseOrder.groupBy({ by: ['vendorId'], where: { deletedAt: null, status: { not: 'CANCELLED' } }, _sum: { grandTotal: true }, _count: { id: true }, orderBy: { _sum: { grandTotal: 'desc' } }, take: 10 })
      .then(async rows => {
        const vendorIds = rows.map(r => r.vendorId)
        const vendors = await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true, vendorCode: true } })
        const map = Object.fromEntries(vendors.map(v => [v.id, v]))
        return rows.map(r => ({ vendor: map[r.vendorId] ?? { id: r.vendorId, name: 'Unknown', vendorCode: '' }, totalSpend: Number(r._sum.grandTotal ?? 0), poCount: r._count.id }))
      }),
    prisma.purchaseOrder.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { id: true } }).then(rows => rows.map(r => ({ status: r.status, count: r._count.id }))),
    prisma.purchaseOrder.findMany({ where: { deletedAt: null, status: { not: 'CANCELLED' }, orderDate: { gte: sixMonthsAgo } }, select: { orderDate: true, grandTotal: true } })
      .then(orders => {
        const byMonth: Record<string, number> = {}
        for (const o of orders) {
          const key = `${o.orderDate.getFullYear()}-${String(o.orderDate.getMonth() + 1).padStart(2, '0')}`
          byMonth[key] = (byMonth[key] ?? 0) + Number(o.grandTotal)
        }
        return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }))
      }),
    prisma.supplierRating.groupBy({ by: ['vendorId'], _avg: { overallScore: true, qualityScore: true, deliveryScore: true, priceScore: true }, _count: { id: true }, orderBy: { _avg: { overallScore: 'desc' } }, take: 10 })
      .then(async rows => {
        const vendorIds = rows.map(r => r.vendorId)
        const vendors = await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } })
        const map = Object.fromEntries(vendors.map(v => [v.id, v]))
        return rows.map(r => ({ vendor: map[r.vendorId] ?? { id: r.vendorId, name: 'Unknown' }, avgOverall: Number((r._avg.overallScore ?? 0).toFixed(1)), avgQuality: Number((r._avg.qualityScore ?? 0).toFixed(1)), avgDelivery: Number((r._avg.deliveryScore ?? 0).toFixed(1)), avgPrice: Number((r._avg.priceScore ?? 0).toFixed(1)), ratingCount: r._count.id }))
      }),
    prisma.vendorInvoice.groupBy({ by: ['status'], where: { deletedAt: null }, _sum: { totalAmount: true, paidAmount: true }, _count: { id: true } })
      .then(rows => rows.map(r => ({ status: r.status, count: r._count.id, total: Number(r._sum.totalAmount ?? 0), paid: Number(r._sum.paidAmount ?? 0) }))),
  ])

  return { topSuppliersBySpend, poStatusBreakdown, monthlySpend: monthlySpendData, supplierAvgRatings, invoicePaymentStats }
}

// ── RFQ ───────────────────────────────────────────────────────────────────

export function listRFQs() {
  return prisma.rfq.findMany({
    where: { deletedAt: null },
    include: { vendor: { select: { name: true } }, pr: { select: { prNumber: true } }, _count: { select: { quotations: true, lineItems: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function createRFQ(data: {
  vendorId: string
  prId?: string | null
  rfqDate: Date
  dueDate: Date
  notes?: string | null
  lineItems?: Array<Record<string, unknown>>
}) {
  const { nextRfqNumber } = await import('@/lib/codes')
  const rfqNumber = await nextRfqNumber()
  return prisma.rfq.create({
    data: {
      rfqNumber,
      vendorId: data.vendorId,
      prId: data.prId ?? undefined,
      rfqDate: data.rfqDate,
      dueDate: data.dueDate,
      notes: data.notes ?? null,
      lineItems: data.lineItems?.length ? { createMany: { data: data.lineItems as any } } : undefined,
    },
    include: { lineItems: true },
  })
}

export function getRFQ(id: string) {
  return prisma.rfq.findUnique({
    where: { id },
    include: { vendor: true, pr: true, lineItems: true, quotations: { where: { deletedAt: null }, include: { vendor: { select: { id: true, name: true } } } } },
  })
}

export function updateRFQ(id: string, data: Record<string, unknown>) {
  return prisma.rfq.update({ where: { id }, data: data as any })
}

export function softDeleteRFQ(id: string) {
  return prisma.rfq.update({ where: { id }, data: { deletedAt: new Date(), status: 'CANCELLED' } })
}

// ── Supplier Contacts ─────────────────────────────────────────────────────

export function listSupplierContacts() {
  return prisma.supplierContact.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, jobTitle: true, department: true, isPrimary: true, createdAt: true, vendor: { select: { id: true, name: true, vendorCode: true } } },
    orderBy: [{ isPrimary: 'desc' }, { firstName: 'asc' }],
  })
}

export async function createSupplierContact(data: {
  vendorId: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  mobile?: string | null
  jobTitle?: string | null
  department?: string | null
  isPrimary?: boolean
  notes?: string | null
}) {
  if (data.isPrimary) {
    await prisma.supplierContact.updateMany({ where: { vendorId: data.vendorId, deletedAt: null }, data: { isPrimary: false } })
  }
  return prisma.supplierContact.create({
    data: { vendorId: data.vendorId, firstName: data.firstName, lastName: data.lastName, email: data.email ?? null, phone: data.phone ?? null, mobile: data.mobile ?? null, jobTitle: data.jobTitle ?? null, department: data.department ?? null, isPrimary: Boolean(data.isPrimary), notes: data.notes ?? null },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, jobTitle: true, department: true, isPrimary: true, createdAt: true, vendor: { select: { id: true, name: true } } },
  })
}

export async function updateSupplierContact(id: string, data: Record<string, unknown>) {
  const { isPrimary, vendorId, ...rest } = data
  if (isPrimary && vendorId) {
    await prisma.supplierContact.updateMany({ where: { vendorId: vendorId as string, deletedAt: null }, data: { isPrimary: false } })
  }
  return prisma.supplierContact.update({
    where: { id },
    data: { ...rest as any, ...(isPrimary !== undefined ? { isPrimary: Boolean(isPrimary) } : {}) },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, jobTitle: true, department: true, isPrimary: true, createdAt: true, vendorId: true },
  })
}

export function softDeleteSupplierContact(id: string) {
  return prisma.supplierContact.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Supplier Ratings ──────────────────────────────────────────────────────

export function listSupplierRatings(vendorId?: string | null) {
  return prisma.supplierRating.findMany({
    where: vendorId ? { vendorId } : {},
    include: { vendor: { select: { name: true, vendorCode: true } } },
    orderBy: { ratedAt: 'desc' },
  })
}

export function createSupplierRating(data: {
  vendorId: string
  ratedByName: string
  overallScore: number
  qualityScore?: number
  deliveryScore?: number
  priceScore?: number
  notes?: string | null
}) {
  const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)))
  return prisma.supplierRating.create({
    data: {
      vendorId: data.vendorId,
      ratedByName: data.ratedByName,
      overallScore: clamp(data.overallScore),
      qualityScore: clamp(data.qualityScore ?? 0),
      deliveryScore: clamp(data.deliveryScore ?? 0),
      priceScore: clamp(data.priceScore ?? 0),
      notes: data.notes ?? null,
    },
  })
}

export function deleteSupplierRating(id: string) {
  return prisma.supplierRating.delete({ where: { id } })
}

// ── Vendor Invoice Dashboard ──────────────────────────────────────────────

export async function getVendorInvoiceDashboard() {
  const now = new Date()
  const weekOut = new Date(now.getTime() + 7 * 86400000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [payablesAgg, pendingApprovalCount, dueThisWeekAgg, overdueAgg, paidThisMonthAgg, matchingExceptions, statusGroups, invoicesForTrend, paymentsForTrend, unpaidForAging, recentInvoices] = await Promise.all([
    prisma.vendorInvoice.aggregate({ where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] } }, _sum: { totalAmount: true, paidAmount: true } }),
    prisma.vendorInvoice.count({ where: { deletedAt: null, status: 'DRAFT' } }),
    prisma.vendorInvoice.aggregate({ where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] }, dueDate: { gte: now, lte: weekOut } }, _count: { id: true } }),
    prisma.vendorInvoice.aggregate({ where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] }, dueDate: { lt: now } }, _sum: { totalAmount: true, paidAmount: true }, _count: { id: true } }),
    prisma.vendorPayment.aggregate({ where: { paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.vendorInvoice.count({ where: { deletedAt: null, matchingStatus: 'MISMATCH' } }),
    prisma.vendorInvoice.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { id: true } }),
    prisma.vendorInvoice.findMany({ where: { deletedAt: null, invoiceDate: { gte: sixMonthsAgo } }, select: { invoiceDate: true, totalAmount: true } }),
    prisma.vendorPayment.findMany({ where: { paymentDate: { gte: sixMonthsAgo } }, select: { paymentDate: true, amount: true } }),
    prisma.vendorInvoice.findMany({ where: { deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] } }, select: { totalAmount: true, paidAmount: true, dueDate: true } }),
    prisma.vendorInvoice.findMany({ where: { deletedAt: null }, include: { vendor: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 8 }),
  ])

  const totalPayables = Number(payablesAgg._sum.totalAmount ?? 0) - Number(payablesAgg._sum.paidAmount ?? 0)
  const overdueTotal = Number(overdueAgg._sum.totalAmount ?? 0) - Number(overdueAgg._sum.paidAmount ?? 0)
  const statusDistribution = statusGroups.map(g => ({ status: g.status, count: g._count.id }))

  const byMonthReceived: Record<string, number> = {}
  for (const inv of invoicesForTrend) {
    const key = `${inv.invoiceDate.getFullYear()}-${String(inv.invoiceDate.getMonth() + 1).padStart(2, '0')}`
    byMonthReceived[key] = (byMonthReceived[key] ?? 0) + Number(inv.totalAmount)
  }
  const byMonthPaid: Record<string, number> = {}
  for (const p of paymentsForTrend) {
    const key = `${p.paymentDate.getFullYear()}-${String(p.paymentDate.getMonth() + 1).padStart(2, '0')}`
    byMonthPaid[key] = (byMonthPaid[key] ?? 0) + Number(p.amount)
  }
  let runningOutstanding = 0
  const payablesTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const received = byMonthReceived[key] ?? 0
    const paid = byMonthPaid[key] ?? 0
    runningOutstanding += received - paid
    return { month: key, received, paid, outstanding: Math.max(0, runningOutstanding) }
  })

  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
  for (const inv of unpaidForAging) {
    const balance = Number(inv.totalAmount) - Number(inv.paidAmount)
    if (balance <= 0) continue
    const daysPastDue = Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000))
    if (daysPastDue <= 30) buckets['0-30'] += balance
    else if (daysPastDue <= 60) buckets['31-60'] += balance
    else if (daysPastDue <= 90) buckets['61-90'] += balance
    else buckets['90+'] += balance
  }
  const agingAnalysis = Object.entries(buckets).map(([bucket, amount]) => ({ bucket, amount }))

  return {
    kpis: { totalPayables, pendingApproval: pendingApprovalCount, dueThisWeek: dueThisWeekAgg._count.id, overdueCount: overdueAgg._count.id, overdueTotal, paidThisMonth: Number(paidThisMonthAgg._sum.amount ?? 0), matchingExceptions },
    statusDistribution, payablesTrend, agingAnalysis, recentInvoices,
  }
}

// ── Vendor Payments ───────────────────────────────────────────────────────

export function listVendorPayments() {
  return prisma.vendorPayment.findMany({
    include: { vendorInvoice: { include: { vendor: { select: { name: true } } } } },
    orderBy: { paymentDate: 'desc' },
    take: 200,
  })
}

export async function recordVendorPayment(tx: Prisma.TransactionClient, data: {
  vendorInvoiceId: string
  amount: number
  paymentDate?: Date
  paymentMethod: string
  reference?: string | null
  notes?: string | null
}) {
  const payment = await tx.vendorPayment.create({
    data: { vendorInvoiceId: data.vendorInvoiceId, amount: data.amount, paymentDate: data.paymentDate ?? new Date(), paymentMethod: data.paymentMethod, reference: data.reference ?? null, notes: data.notes ?? null },
  })
  const inv = await tx.vendorInvoice.findUnique({ where: { id: data.vendorInvoiceId } })
  if (inv) {
    const newPaid = Number(inv.paidAmount) + data.amount
    const status = newPaid >= Number(inv.totalAmount) ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : inv.status
    await tx.vendorInvoice.update({ where: { id: data.vendorInvoiceId }, data: { paidAmount: newPaid, status } })
  }
  return payment
}

// ── Purchase Returns (list/create) ────────────────────────────────────────

export function listPurchaseReturns() {
  return prisma.purchaseReturn.findMany({
    where: { deletedAt: null },
    include: { vendor: { select: { name: true } }, grn: { select: { grnNumber: true } }, invoice: { select: { invoiceNumber: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export function listGRNs(companyId: string | undefined) {
  return prisma.goodsReceiptNote.findMany({
    where: companyId ? { companyId } : {},
    include: { po: { include: { vendor: { select: { name: true } } } }, _count: { select: { lineItems: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createGRN(data: {
  poId: string
  receivedDate: Date
  receivedById: string
  notes?: string | null
  companyId?: string | null
  lineItems: Array<{ poLineItemId?: string; receivedQty: number; acceptedQty: number; rejectedQty: number; unitPrice: number; itemId?: string; warehouseId?: string }>
}) {
  const grnNumber = await import('@/lib/services/numbering').then(m => m.nextDocNumber('grn'))
  const sentIds = [...new Set(data.lineItems.map(l => l.poLineItemId).filter(Boolean))] as string[]
  const existingPoItems = sentIds.length
    ? await prisma.pOLineItem.findMany({ where: { id: { in: sentIds } }, select: { id: true } })
    : []
  const validIdSet = new Set(existingPoItems.map(p => p.id))
  const safeLines = data.lineItems.map(l => ({
    ...l,
    poLineItemId: l.poLineItemId && validIdSet.has(l.poLineItemId) ? l.poLineItemId : undefined,
  }))

  return prisma.$transaction(async (tx) => {
    const g = await tx.goodsReceiptNote.create({
      data: { grnNumber, poId: data.poId, companyId: data.companyId ?? undefined, receivedDate: data.receivedDate, receivedById: data.receivedById, notes: data.notes ?? null,
        lineItems: safeLines.length ? { createMany: { data: safeLines } } : undefined },
      include: { lineItems: true },
    })

    const allGRNs = await tx.gRNLineItem.findMany({ where: { grn: { poId: data.poId } } })
    const poItems = await tx.pOLineItem.findMany({ where: { poId: data.poId } })
    const totalOrdered = poItems.reduce((s, i) => s + Number(i.quantity), 0)
    const totalReceived = allGRNs.reduce((s, i) => s + Number(i.receivedQty), 0)
    const poStatus = totalReceived >= totalOrdered ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED'
    await tx.purchaseOrder.update({ where: { id: data.poId }, data: { status: poStatus } })

    const { incrementStock } = await import('@/lib/stock')
    const stockLines = g.lineItems.filter((li): li is typeof li & { itemId: string; warehouseId: string } => !!li.itemId && !!li.warehouseId && Number(li.acceptedQty) > 0)
    for (const li of stockLines) {
      await incrementStock(tx, li.itemId, li.warehouseId, Number(li.acceptedQty), Number(li.unitPrice), {
        referenceType: 'GRN', referenceId: g.id,
        notes: `GRN ${grnNumber}`, transactionDate: data.receivedDate,
      })
    }

    return g
  })
}

export async function createPurchaseReturn(data: {
  vendorId: string
  grnId?: string | null
  invoiceId?: string | null
  returnDate: Date
  reason: string
  notes?: string | null
  lineItems?: Array<{ unitPrice: number; quantity: number; description?: string; itemId?: string; warehouseId?: string }>
}) {
  const { nextPurchaseReturnNumber } = await import('@/lib/codes')
  const returnNumber = await nextPurchaseReturnNumber()
  const totalAmount = (data.lineItems ?? []).reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0)
  return prisma.purchaseReturn.create({
    data: {
      returnNumber,
      vendorId: data.vendorId,
      grnId: data.grnId ?? null,
      invoiceId: data.invoiceId ?? null,
      returnDate: data.returnDate,
      reason: data.reason,
      notes: data.notes ?? null,
      totalAmount,
      lineItems: data.lineItems?.length ? { createMany: { data: data.lineItems.map(i => ({ description: i.description ?? '', unitPrice: i.unitPrice, quantity: i.quantity, totalPrice: Number(i.unitPrice) * Number(i.quantity), itemId: i.itemId ?? null, warehouseId: i.warehouseId ?? null })) } } : undefined,
    },
    include: { lineItems: true },
  })
}

export async function autoReserveAfterGRN(poId: string): Promise<{ reserved: boolean; count: number }> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { pr: { select: { sourceSoId: true } } },
  })
  const sourceSoId = po?.pr?.sourceSoId
  if (!sourceSoId) return { reserved: false, count: 0 }

  const so = await prisma.salesOrder.findUnique({
    where: { id: sourceSoId },
    include: { lineItems: true },
  })
  if (!so || so.status !== 'PENDING_PO') return { reserved: false, count: 0 }

  const itemIds = [...new Set(so.lineItems.filter(li => li.itemId).map(li => li.itemId!))]
  const allStocks = await prisma.warehouseStock.findMany({ where: { itemId: { in: itemIds } } })
  const stockByItem = new Map<string, typeof allStocks>()
  for (const s of allStocks) {
    if (!stockByItem.has(s.itemId)) stockByItem.set(s.itemId, [])
    stockByItem.get(s.itemId)!.push(s)
  }

  let canReserve = true
  const reservations: Array<{ soId: string; soItemId: string; itemId: string; warehouseId: string; reservedQty: number }> = []
  for (const li of so.lineItems) {
    if (!li.itemId) continue
    const needed = Number(li.quantity)
    const stocks = stockByItem.get(li.itemId) || []
    const totalAvailable = stocks.reduce((s, ws) => s + Number(ws.quantity), 0)
    if (totalAvailable < needed) { canReserve = false; break }
    let remaining = needed
    for (const ws of stocks) {
      if (remaining <= 0) break
      const allocate = Math.min(Number(ws.quantity), remaining)
      reservations.push({ soId: sourceSoId, soItemId: li.id, itemId: li.itemId, warehouseId: ws.warehouseId, reservedQty: allocate })
      remaining -= allocate
    }
  }

  if (canReserve && reservations.length > 0) {
    await prisma.$transaction([
      ...reservations.map((r) => prisma.stockReservation.create({ data: r })),
      prisma.salesOrder.update({ where: { id: sourceSoId }, data: { status: 'RESERVED' } }),
    ])
    return { reserved: true, count: reservations.length }
  }

  return { reserved: false, count: 0 }
}
