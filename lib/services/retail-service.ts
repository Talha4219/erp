import prisma from '@/lib/prisma'

const r2 = (n: number) => Math.round(n * 100) / 100

// ── Batches ─────────────────────────────────────────────────────────────

export async function listBatches(itemId?: string | null) {
  return prisma.inventoryBatch.findMany({
    where: itemId ? { itemId } : {},
    include: { item: true, vendor: true },
    orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
    take: 200,
  })
}

export async function getLowStockProducts() {
  const items = await prisma.item.findMany({
    where: { deletedAt: null },
    include: { batches: { where: { quantityOnHand: { gt: 0 } } } },
  })
  return items.filter(p => {
    const totalQty = p.batches.reduce((sum, b) => sum + Number(b.quantityOnHand), 0)
    return totalQty <= Number(p.reorderPoint)
  })
}

export async function getExpiringBatches(days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + days)
  return prisma.inventoryBatch.findMany({
    where: { expiryDate: { lte: cutoff, gte: new Date() }, quantityOnHand: { gt: 0 } },
    include: { item: true, vendor: true },
    orderBy: { expiryDate: 'asc' },
    take: 200,
  })
}

export async function createBatch(data: Record<string, unknown>) {
  const { expiryDate, manufacturingDate, receivedDate, ...rest } = data as any
  return prisma.inventoryBatch.create({
    data: { ...rest, manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null, expiryDate: expiryDate ? new Date(expiryDate) : null, receivedDate: receivedDate ? new Date(receivedDate) : new Date() },
  })
}

export async function adjustBatch(batchId: string, data: { quantityChange: number; reason: string }, userId: string, userName: string) {
  const id = parseInt(batchId)
  return prisma.$transaction(async (tx) => {
    const batch = await tx.inventoryBatch.findUniqueOrThrow({ where: { id } })
    const newQty = Number(batch.quantityOnHand) + data.quantityChange
    if (newQty < 0) throw new Error('Insufficient stock')
    const adjustment = await tx.stockAdjustment.create({ data: { batchId: id, quantityChange: data.quantityChange, reason: data.reason, adjustedBy: userName } })
    await tx.inventoryBatch.update({ where: { id }, data: { quantityOnHand: newQty } })
    await tx.auditLog.create({ data: { userId, action: 'STOCK_ADJUSTMENT', entity: 'InventoryBatch', entityId: String(batchId), oldValues: { quantityOnHand: batch.quantityOnHand }, newValues: { quantityOnHand: newQty, reason: data.reason } } })
    return adjustment
  })
}

// ── Customers ───────────────────────────────────────────────────────────

export function listCustomers(search?: string | null) {
  return prisma.retailCustomer.findMany({
    where: { deletedAt: null, ...(search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}) },
    include: { addresses: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

export function getCustomer(id: string) {
  return prisma.retailCustomer.findUnique({
    where: { id: parseInt(id) },
    include: { addresses: true },
  })
}

export function createCustomer(data: Record<string, unknown>) {
  const { gdprConsentDate, dateOfBirth, ...rest } = data as any
  return prisma.retailCustomer.create({ data: { ...rest, gdprConsentDate: gdprConsentDate ? new Date(gdprConsentDate) : null, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null } })
}

export function updateCustomer(id: string, data: Record<string, unknown>) {
  const { gdprConsentDate, dateOfBirth, ...rest } = data as any
  return prisma.retailCustomer.update({ where: { id: parseInt(id) }, data: { ...rest, gdprConsentDate: gdprConsentDate ? new Date(gdprConsentDate) : undefined, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined } })
}

export function softDeleteCustomer(id: string) {
  return prisma.retailCustomer.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date() } })
}

export async function importCustomers(rows: Record<string, string>[]) {
  let success = 0
  const errors: string[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const firstName = row['First Name']?.trim()
      const lastName = row['Last Name']?.trim()
      const email = row['Email']?.trim()
      if (!firstName || !lastName || !email) { errors.push(`Row ${i + 1}: First Name, Last Name, and Email are required`); continue }
      const existing = await prisma.retailCustomer.findUnique({ where: { email } })
      if (existing) { errors.push(`Row ${i + 1}: Email ${email} already exists`); continue }
      await prisma.retailCustomer.create({ data: { title: row['Title']?.trim() || null, firstName, lastName, email, phone: row['Phone']?.trim() || null, dateOfBirth: row['Date of Birth (YYYY-MM-DD)']?.trim() ? new Date(row['Date of Birth (YYYY-MM-DD)'].trim()) : null, marketingOptIn: row['Marketing Opt-In (TRUE/FALSE)']?.trim().toUpperCase() === 'TRUE', gdprConsentDate: row['GDPR Consent Date (YYYY-MM-DD)']?.trim() ? new Date(row['GDPR Consent Date (YYYY-MM-DD)'].trim()) : null } })
      success++
    } catch (err) { errors.push(`Row ${i + 1}: ${(err as Error).message}`) }
  }
  return { success, failed: rows.length - success, errors }
}

export async function exportCustomerData(id: string) {
  const customer = await prisma.retailCustomer.findUnique({
    where: { id: parseInt(id) },
    include: { addresses: true },
  })
  if (!customer) return null
  const rows: string[] = [
    'Section,Field,Value',
    `Customer,ID,${customer.id}`,
    `Customer,Name,"${customer.firstName} ${customer.lastName}"`,
    `Customer,Email,${customer.email}`,
    `Customer,Phone,${customer.phone ?? ''}`,
    `Customer,DOB,${customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString('en-GB') : ''}`,
    `Customer,Loyalty Points,${customer.loyaltyPointsBalance}`,
    `Customer,Marketing Opt-In,${customer.marketingOptIn}`,
    `Customer,GDPR Consent Date,${customer.gdprConsentDate ? new Date(customer.gdprConsentDate).toLocaleDateString('en-GB') : ''}`,
  ]
  for (const addr of customer.addresses) rows.push(`Address,${addr.addressLine1} ${addr.city} ${addr.postcode},${addr.isPrimary ? 'Primary' : ''}`)
  return rows.join('\n')
}

export async function anonymiseCustomer(id: string, userId: string) {
  const customerId = parseInt(id)
  await prisma.retailCustomer.update({ where: { id: customerId }, data: { firstName: 'Anonymised', lastName: 'Anonymised', email: `anon-${customerId}@deleted.invalid`, phone: null, dateOfBirth: null, marketingOptIn: false, gdprConsentDate: null, isAnonymised: true } })
  await prisma.auditLog.create({ data: { userId, action: 'GDPR_ANONYMISE', entity: 'RetailCustomer', entityId: id } })
}

// ── Dashboard ────────────────────────────────────────────────────────────

export async function getRetailDashboard() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekStart = new Date(now.getTime() - 7 * 86400000)
  const lastYearToday = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  const lastYearTodayEnd = new Date(lastYearToday.getTime() + 86400000)

  const posWhere = (start: Date, end: Date) => ({ channel: 'POS' as const, orderDate: { gte: start, lt: end } })

  const [todayOrders, weekOrders, monthOrders, batches, expenses, stockLedger, lastYearOrders] = await Promise.all([
    prisma.salesOrderV2.findMany({ where: posWhere(todayStart, todayEnd), include: { lineItems: true } }),
    prisma.salesOrderV2.findMany({ where: posWhere(weekStart, todayEnd), include: { lineItems: true } }),
    prisma.salesOrderV2.findMany({ where: posWhere(monthStart, todayEnd), include: { lineItems: true } }),
    prisma.inventoryBatch.findMany({ where: { quantityOnHand: { gt: 0 } }, select: { id: true, expiryDate: true, quantityOnHand: true, item: { select: { sellingPrice: true, reorderPoint: true } } } }),
    prisma.expense.findMany({ where: { expenseDate: { gte: monthStart, lte: todayEnd }, deletedAt: null }, select: { amountGbp: true, category: { select: { categoryName: true } } } }),
    prisma.stockLedger.aggregate({ where: { referenceType: 'POS', transactionDate: { gte: monthStart, lt: todayEnd } }, _sum: { totalCost: true } }),
    prisma.salesOrderV2.findMany({ where: posWhere(lastYearToday, lastYearTodayEnd), include: { lineItems: true } }),
  ])

  const calcOrderTotal = (orders: typeof todayOrders) => orders.reduce((s, o) => s + Number(o.totalAmount), 0)
  const calcNetTotal = (orders: typeof todayOrders) => orders.reduce((s, o) => s + Number(o.subTotal), 0)

  const todaySales = r2(calcOrderTotal(todayOrders))
  const weekSales = r2(calcOrderTotal(weekOrders))
  const monthSales = r2(calcOrderTotal(monthOrders))
  const mtdNetSales = r2(calcNetTotal(monthOrders))
  const lastYearSales = r2(calcOrderTotal(lastYearOrders))
  const todayTransactionCount = todayOrders.length

  const mtdCogs = r2(Number(stockLedger._sum.totalCost ?? 0))
  const grossProfitMtd = r2(mtdNetSales - mtdCogs)
  const grossProfitMtdPct = mtdNetSales > 0 ? r2((grossProfitMtd / mtdNetSales) * 100) : 0
  const salesVariancePct = lastYearSales > 0 ? r2(((todaySales - lastYearSales) / lastYearSales) * 100) : 0

  const avgTransactionValue = monthOrders.length > 0 ? r2(monthSales / monthOrders.length) : 0
  const wageCost = r2(expenses.filter(e => e.category?.categoryName?.toLowerCase().includes('wage')).reduce((s, e) => s + Number(e.amountGbp), 0))
  const wageCostRatio = monthSales > 0 ? r2((wageCost / monthSales) * 100) : 0

  const wasteAdjustments = await prisma.stockAdjustment.findMany({ where: { adjustedAt: { gte: todayStart, lt: todayEnd }, reason: { contains: 'expired' } }, include: { batch: { include: { item: { select: { sellingPrice: true } } } } } })
  const wasteValueToday = r2(wasteAdjustments.reduce((s, a) => s + Math.abs(Number(a.quantityChange)) * Number(a.batch?.item?.sellingPrice ?? 0), 0))

  const lowStockCount = batches.filter(b => b.item && Number(b.quantityOnHand) <= Number(b.item.reorderPoint)).length
  const expiryAlerts7Day = batches.filter(b => b.expiryDate && b.expiryDate <= new Date(Date.now() + 7 * 86400000)).length

  return {
    todaySales, lastYearSameDay: lastYearSales, salesVariancePct,
    weekSales, mtdSales: monthSales, mtdNetSales, mtdCogs,
    grossProfitMtd, grossProfitMtdPct,
    todayTransactionCount, avgTransactionValue,
    wageCostRatio, wasteValueToday, lowStockCount, expiryAlerts7Day,
  }
}

// ── Expenses ────────────────────────────────────────────────────────────

export function listExpenses(searchParams: URLSearchParams) {
  const categoryId = searchParams.get('categoryId')
  const supplierId = searchParams.get('supplierId')
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const categoriesOnly = searchParams.get('categoriesOnly')
  if (categoriesOnly) return prisma.expenseCategory.findMany({ orderBy: { categoryName: 'asc' } })
  const where: Record<string, unknown> = { deletedAt: null }
  if (categoryId) where.categoryId = parseInt(categoryId)
  if (supplierId) where.vendorId = supplierId
  if (status) where.status = status
  if (from || to) { where.expenseDate = {}; if (from) (where.expenseDate as any).gte = new Date(from); if (to) (where.expenseDate as any).lte = new Date(to + 'T23:59:59Z') }
  return prisma.expense.findMany({ where: where as any, include: { category: { select: { id: true, categoryName: true } }, vendor: { select: { id: true, name: true } } }, orderBy: { expenseDate: 'desc' }, take: 200 })
}

export function createExpenseCategory(name: string) {
  return prisma.expenseCategory.create({ data: { categoryName: name } })
}

export function deleteExpenseCategory(id: string) {
  return prisma.expenseCategory.delete({ where: { id: parseInt(id) } })
}

export function createExpense(data: Record<string, unknown>) {
  return prisma.expense.create({ data: data as any })
}

export async function updateExpense(id: string, data: Record<string, unknown>) {
  const expenseId = parseInt(id)
  if (typeof data.togglePaid === 'boolean' && data.togglePaid) {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } })
    if (!expense) throw new Error('Not found')
    return prisma.expense.update({ where: { id: expenseId }, data: { status: expense.status === 'Paid' ? 'Unpaid' : 'Paid' } })
  }
  return prisma.expense.update({ where: { id: expenseId }, data: data as any })
}

export function softDeleteExpense(id: string) {
  return prisma.expense.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date() } })
}

// ── Products ────────────────────────────────────────────────────────────

export function listProducts(searchParams: URLSearchParams) {
  const search = searchParams.get('search')
  const category = searchParams.get('category')
  const where: Record<string, unknown> = { deletedAt: null }
  if (search) where.OR = [{ productName: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }]
  if (category) where.category = category
  return prisma.product.findMany({
    where: where as any,
    orderBy: { productName: 'asc' }, take: 200,
  })
}

export function getProduct(id: string) {
  return prisma.product.findUnique({ where: { id: parseInt(id) } })
}

export function createProduct(data: Record<string, unknown>) {
  return prisma.product.create({ data: data as any })
}

export function updateProduct(id: string, data: Record<string, unknown>) {
  return prisma.product.update({ where: { id: parseInt(id) }, data: data as any })
}

export function softDeleteProduct(id: string) {
  return prisma.product.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date() } })
}

// ── Purchase Orders ─────────────────────────────────────────────────────

export function listPurchaseOrders(status?: string | null) {
  return prisma.retailPurchaseOrder.findMany({
    where: { deletedAt: null, ...(status && { status }) },
    include: { supplier: { select: { id: true, companyName: true } }, lineItems: { include: { product: true } } },
    orderBy: { orderDate: 'desc' }, take: 100,
  })
}

export function getPurchaseOrder(id: string) {
  return prisma.retailPurchaseOrder.findUnique({
    where: { id: parseInt(id) }, include: { supplier: true, lineItems: { include: { product: true } }, grns: true },
  })
}

export async function createPurchaseOrder(data: { supplierId: number; notes?: string; expectedDeliveryDate?: string; lineItems: { productId: number; quantityOrdered: number; unitCostGbp: number }[] }) {
  const totalCostGbp = r2(data.lineItems.reduce((s, li) => s + li.quantityOrdered * li.unitCostGbp, 0))
  return prisma.$transaction(async (tx) => {
    const po = await tx.retailPurchaseOrder.create({
      data: { supplierId: data.supplierId, totalCostGbp, expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : undefined, lineItems: { create: data.lineItems } },
      include: { lineItems: true },
    })
    await tx.auditLog.create({ data: { userId: '', action: 'CREATE_PO', entity: 'RetailPurchaseOrder', entityId: String(po.id), newValues: { totalCostGbp } } })
    return po
  })
}

export async function updatePurchaseOrder(id: string, data: { status?: string; expectedDeliveryDate?: string }) {
  const poId = parseInt(id)
  const existing = await prisma.retailPurchaseOrder.findUnique({ where: { id: poId } })
  if (!existing) throw new Error('Not found')
  return prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {}
    if (data.status) updateData.status = data.status
    if (data.expectedDeliveryDate) updateData.expectedDeliveryDate = new Date(data.expectedDeliveryDate)
    const updated = await tx.retailPurchaseOrder.update({ where: { id: poId }, data: updateData })
    await tx.auditLog.create({ data: { userId: '', action: 'UPDATE_PO', entity: 'RetailPurchaseOrder', entityId: id, oldValues: { status: existing.status }, newValues: { status: data.status } } })
    return updated
  })
}

export function softDeletePurchaseOrder(id: string) {
  return prisma.retailPurchaseOrder.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date() } })
}

export async function createGrn(poId: string, data: { receivedBy?: string; notes?: string; lineItems: { lineItemId: number; quantityReceived: number }[] }) {
  const id = parseInt(poId)
  const po = await prisma.retailPurchaseOrder.findUnique({ where: { id }, include: { lineItems: { include: { product: true } } } })
  if (!po) throw new Error('Purchase order not found')
  return prisma.$transaction(async (tx) => {
    const grn = await tx.goodsReceivedNote.create({ data: { poId: id, receivedBy: data.receivedBy ?? 'System', notes: data.notes } })
    for (const li of data.lineItems) {
      const poLine = po.lineItems.find(l => l.id === li.lineItemId)
      if (!poLine) throw new Error(`Line item ${li.lineItemId} not found in PO`)
      if (li.quantityReceived > poLine.quantityOrdered) throw new Error(`Cannot receive more than ordered`)
      await tx.retailPoLineItem.update({ where: { id: li.lineItemId }, data: { quantityReceived: { increment: li.quantityReceived } } })
      const item = await tx.item.findUnique({ where: { sku: poLine.product.sku } })
      if (!item) throw new Error(`No item found for product SKU ${poLine.product.sku}`)
      await tx.inventoryBatch.create({ data: { itemId: item.id, quantityOnHand: li.quantityReceived, batchNumber: `GRN-${grn.id}-${li.lineItemId}`, receivedDate: new Date() } })
    }
    const updatedLines = await tx.retailPoLineItem.findMany({ where: { poId: id } })
    const allReceived = updatedLines.every(l => l.quantityReceived >= l.quantityOrdered)
    const anyReceived = updatedLines.some(l => l.quantityReceived > 0)
    await tx.retailPurchaseOrder.update({ where: { id }, data: { status: allReceived ? 'Received' : anyReceived ? 'Partially Received' : po.status } })
    return grn
  })
}

// ── Reports ─────────────────────────────────────────────────────────────

export async function updateRetailOrderPaymentStatus(id: string, status: string) {
  return prisma.salesOrderV2.update({ where: { id }, data: { stripePaymentStatus: status } })
}

export async function getRetailReports(report: string) {
  const now = new Date()

  if (report === 'fefo-expiry') {
    const cutoff = new Date(now.getTime() + 30 * 86400000)
    return prisma.inventoryBatch.findMany({ where: { expiryDate: { gte: now, lte: cutoff }, quantityOnHand: { gt: 0 } }, include: { item: { select: { name: true, sku: true } } }, orderBy: { expiryDate: 'asc' }, take: 200 })
  }

  if (report === 'low-stock') {
    const items = await prisma.item.findMany({ where: { deletedAt: null }, include: { batches: { where: { quantityOnHand: { gt: 0 } } } }, take: 200 })
    return items.filter(p => { const total = p.batches.reduce((s, b) => s + Number(b.quantityOnHand), 0); return total <= Number(p.reorderPoint) })
  }

  if (report === 'grn-discrepancy') {
    return prisma.retailPurchaseOrder.findMany({ where: { deletedAt: null }, include: { lineItems: { select: { quantityOrdered: true, quantityReceived: true, product: { select: { productName: true } } } } }, take: 100 }).then(pos => pos.filter(po => po.lineItems.some(li => li.quantityReceived !== li.quantityOrdered)))
  }

  if (report === 'daily-sales') {
    const orders = await prisma.salesOrderV2.findMany({ where: { channel: 'POS', orderDate: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30) } }, include: { lineItems: true }, take: 1000 })
    const byPayment: Record<string, { total: number; count: number }> = {}
    let totalItems = 0
    for (const o of orders) {
      if (!o.stripePaymentIntentId && o.stripePaymentStatus !== 'succeeded') {
        byPayment['Cash'] ??= { total: 0, count: 0 }
        byPayment['Cash'].total += Number(o.totalAmount)
        byPayment['Cash'].count++
      } else {
        byPayment['Card'] ??= { total: 0, count: 0 }
        byPayment['Card'].total += Number(o.totalAmount)
        byPayment['Card'].count++
      }
      totalItems += o.lineItems.reduce((s, li) => s + Number(li.quantity), 0)
    }
    return { byPaymentMethod: byPayment, avgBasketSize: orders.length > 0 ? r2(totalItems / orders.length) : 0 }
  }

  if (report === 'supplier-performance') {
    return prisma.retailPurchaseOrder.findMany({ where: { status: 'Received', deletedAt: null }, include: { supplier: { select: { companyName: true } } }, take: 100 }).then(pos => pos.map(po => ({ poId: po.id, supplier: po.supplier.companyName, expectedDeliveryDate: po.expectedDeliveryDate, deliveryVarianceDays: po.expectedDeliveryDate ? Math.round((now.getTime() - new Date(po.expectedDeliveryDate).getTime()) / 86400000) : 0 })))
  }

  if (report === 'category-profitability') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const orders = await prisma.salesOrderV2.findMany({ where: { channel: 'POS', orderDate: { gte: monthStart } }, include: { lineItems: { include: { item: { include: { category: true } } } } }, take: 500 })
    const catMap: Record<string, { revenue: number; cogs: number; count: number }> = {}
    for (const o of orders) {
      for (const li of o.lineItems) {
        const cat = li.item?.category?.name ?? 'Uncategorised'
        catMap[cat] ??= { revenue: 0, cogs: 0, count: 0 }
        catMap[cat].revenue += Number(li.unitPrice) * Number(li.quantity)
        catMap[cat].cogs += Number(li.item?.standardCost ?? 0) * Number(li.quantity)
        catMap[cat].count++
      }
    }
    return Object.entries(catMap).map(([name, data]) => ({ category: name, revenue: r2(data.revenue), cogs: r2(data.cogs), grossProfit: r2(data.revenue - data.cogs), margin: data.revenue > 0 ? r2(((data.revenue - data.cogs) / data.revenue) * 100) : 0, orderCount: data.count }))
  }

  if (report === 'customer-ltv') {
    const customers = await prisma.retailCustomer.findMany({ where: { deletedAt: null }, take: 200 })
    const result = []
    for (const c of customers) {
      if (!c.email) continue
      const unified = await prisma.customer.findFirst({ where: { email: c.email } })
      if (!unified) continue
      const orders = await prisma.salesOrderV2.findMany({ where: { customerId: unified.id, channel: 'POS' }, select: { totalAmount: true, orderDate: true } })
      const totalSpent = orders.reduce((s, o) => s + Number(o.totalAmount), 0)
      const orderCount = orders.length
      result.push({ customerId: c.id, name: `${c.firstName} ${c.lastName}`, totalSpent: r2(totalSpent), orderCount, avgOrderValue: orderCount > 0 ? r2(totalSpent / orderCount) : 0, cohort: c.createdAt.toISOString().slice(0, 7) })
    }
    return result
  }

  throw new Error('Unknown report type')
}

// ── Store Settings ──────────────────────────────────────────────────────

export function getStoreSettings() {
  return prisma.storeSettings.findUnique({ where: { id: 'store' } })
}

export function upsertStoreSettings(data: Record<string, unknown>) {
  return prisma.storeSettings.upsert({ where: { id: 'store' }, create: { id: 'store', ...data } as any, update: data as any })
}

// ── Suppliers ───────────────────────────────────────────────────────────

export function listSuppliers(search?: string | null) {
  return prisma.supplier.findMany({ where: { isActive: true, deletedAt: null, ...(search ? { companyName: { contains: search, mode: 'insensitive' } } : {}) }, include: { _count: { select: { retailPurchaseOrders: true } }, catalogue: true }, orderBy: { companyName: 'asc' }, take: 200 })
}

export function getSupplier(id: string) {
  return prisma.supplier.findUnique({ where: { id: parseInt(id) }, include: { catalogue: true, retailPurchaseOrders: { where: { deletedAt: null }, orderBy: { orderDate: 'desc' }, take: 10 } } })
}

export function createSupplier(data: Record<string, unknown>) {
  return prisma.supplier.create({ data: data as any })
}

export function updateSupplier(id: string, data: Record<string, unknown>) {
  return prisma.supplier.update({ where: { id: parseInt(id) }, data: data as any })
}

export function softDeleteSupplier(id: string) {
  return prisma.supplier.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date(), isActive: false } })
}

export async function importSuppliers(rows: Record<string, string>[]) {
  let success = 0
  const errors: string[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const companyName = row['Company Name']?.trim()
      if (!companyName) { errors.push(`Row ${i + 1}: Company Name required`); continue }
      const leadTime = parseInt(row['Lead Time (Days)']) || 7
      const rating = parseInt(row['Performance Rating']) || 3
      await prisma.supplier.create({ data: { companyName, contactPerson: row['Contact Name']?.trim(), email: row['Email']?.trim(), phone: row['Phone']?.trim(), leadTimeDays: leadTime > 0 ? leadTime : 7, performanceRating: rating > 0 ? Math.min(rating, 5) : 3, isActive: true } })
      success++
    } catch (err) { errors.push(`Row ${i + 1}: ${(err as Error).message}`) }
  }
  return { success, failed: rows.length - success, errors }
}
