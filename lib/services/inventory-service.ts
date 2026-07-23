import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { nextItemSku, nextItemBarcode } from '@/lib/codes'


// ── Items ────────────────────────────────────────────────────────────────

export function listItems(search?: string, barcode?: string) {
  return prisma.item.findMany({
    where: {
      deletedAt: null,
      ...(barcode
        ? { OR: [{ barcode }, { secondaryBarcode: barcode }, { sku: barcode }] }
        : search ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
              { barcode: { contains: search } },
            ],
          } : {}),
    },
    include: {
      category: { select: { id: true, name: true } },
      warehouseStocks: { include: { warehouse: { select: { id: true, name: true } } } },
    },
    orderBy: [{ expiryDate: 'asc' }, { name: 'asc' }],
    take: 200,
  })
}

export function getItem(id: string) {
  return prisma.item.findUnique({ where: { id }, include: { category: true } })
}

export async function createItem(tx: Prisma.TransactionClient, data: {
  sku?: string
  barcode?: string
  barcodeType?: string
  secondaryBarcode?: string | null
  name: string
  description?: string | null
  uom?: string
  packing?: string | null
  vatRate?: number
  standardCost?: number
  sellingPrice?: number
  reorderPoint?: number
  reorderQty?: number
  expiryDate?: Date | null
  categoryId?: string | null
  isSellable?: boolean
  isPurchasable?: boolean
  warehouseId?: string | null
  quantity?: number
}) {
  const sku = data.sku?.trim() || await nextItemSku(tx)
  const barcode = data.barcode?.trim() || await nextItemBarcode(tx)

  const created = await tx.item.create({
    data: {
      sku,
      barcode,
      barcodeType: data.barcodeType ?? 'CODE128',
      secondaryBarcode: data.secondaryBarcode?.trim() || null,
      name: data.name,
      description: data.description ?? null,
      uom: data.uom ?? 'EA',
      packing: data.packing || null,
      vatRate: data.vatRate ?? 0.2,
      standardCost: data.standardCost ?? 0,
      sellingPrice: data.sellingPrice ?? 0,
      reorderPoint: data.reorderPoint ?? 0,
      reorderQty: data.reorderQty ?? 0,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      categoryId: data.categoryId ?? null,
      isSellable: data.isSellable ?? true,
      isPurchasable: data.isPurchasable ?? true,
    } as any,
  })

  if (data.warehouseId) {
    const initialQty = Math.max(0, Number(data.quantity) || 0)
    await tx.warehouseStock.upsert({
      where: { warehouseId_itemId: { warehouseId: data.warehouseId, itemId: created.id } },
      create: { warehouseId: data.warehouseId, itemId: created.id, quantity: initialQty, avgCost: initialQty > 0 ? (data.standardCost ?? 0) : 0 },
      update: {},
    })
    if (initialQty > 0) {
      const cost = Number(data.standardCost) || 0
      await tx.stockLedger.create({
        data: {
          itemId: created.id,
          warehouseId: data.warehouseId,
          transactionType: 'IN',
          quantity: initialQty,
          unitCost: cost,
          totalCost: initialQty * cost,
          referenceType: 'INITIAL_STOCK',
          referenceId: created.id,
          notes: `Opening stock for ${created.name}`,
          transactionDate: new Date(),
        },
      })
    }
  }

  return created
}

const itemUpdateFields = ['sku', 'barcode', 'barcodeType', 'secondaryBarcode', 'name', 'description',
  'uom', 'packing', 'vatRate', 'categoryId', 'standardCost', 'sellingPrice',
  'reorderPoint', 'reorderQty', 'expiryDate', 'isActive', 'isSellable', 'isPurchasable'] as const

export function sanitizeItemInput(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const f of itemUpdateFields) {
    if (body[f] !== undefined) {
      if (f === 'expiryDate') data[f] = body[f] ? new Date(body[f] as string) : null
      else if (f === 'secondaryBarcode') data[f] = typeof body[f] === 'string' && (body[f] as string).trim() ? (body[f] as string).trim() : null
      else if (f === 'sku' || f === 'barcode') data[f] = typeof body[f] === 'string' && (body[f] as string).trim() ? (body[f] as string).trim() : body[f]
      else data[f] = body[f]
    }
  }
  return data
}

export async function updateItemWithWarehouse(
  tx: Prisma.TransactionClient,
  id: string,
  data: Record<string, unknown>,
  warehouseId?: string | null,
) {
  const updated = await tx.item.update({ where: { id }, data: data as any })
  if (warehouseId) {
    await tx.warehouseStock.upsert({
      where: { warehouseId_itemId: { warehouseId, itemId: updated.id } },
      create: { warehouseId, itemId: updated.id, quantity: 0, avgCost: Number(data.standardCost ?? updated.standardCost) || 0 },
      update: {},
    })
  }
  return updated
}

export function softDeleteItem(id: string) {
  return prisma.item.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Stock Ledger ─────────────────────────────────────────────────────────

export function listStockLedger(itemId?: string, warehouseId?: string) {
  return prisma.stockLedger.findMany({
    where: {
      ...(itemId ? { itemId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
    },
    include: { item: { select: { id: true, name: true, sku: true } }, warehouse: { select: { id: true, name: true } } },
    orderBy: { transactionDate: 'desc' },
    take: 200,
  })
}

// ── Cycle Counts ─────────────────────────────────────────────────────────

const cycleCountIncludes = {
  warehouse: { select: { id: true, name: true } },
  lineItems: { include: { item: { select: { id: true, name: true, packing: true, sku: true, uom: true } } } },
} as const

export function listCycleCounts() {
  return prisma.cycleCount.findMany({
    include: cycleCountIncludes,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function createCycleCount(data: {
  warehouseId: string
  countDate: Date
  notes?: string | null
  lineItems: Array<{ itemId: string; systemQty: number; countedQty?: number | null; notes?: string | null }>
}) {
  const count = await prisma.cycleCount.count()
  const countNumber = `CC-${String(count + 1).padStart(5, '0')}`

  return prisma.cycleCount.create({
    data: {
      countNumber,
      warehouseId: data.warehouseId,
      countDate: data.countDate,
      notes: data.notes ?? null,
      lineItems: {
        create: data.lineItems.map((l) => {
          const variance = l.countedQty != null ? Number(l.countedQty) - Number(l.systemQty) : null
          return { itemId: l.itemId, systemQty: l.systemQty, countedQty: l.countedQty ?? null, variance, notes: l.notes }
        }),
      },
    },
    include: {
      warehouse: true,
      lineItems: { include: { item: true } },
    },
  })
}

export function getCycleCount(id: string) {
  return prisma.cycleCount.findUnique({
    where: { id },
    include: { warehouse: true, lineItems: { include: { item: true } } },
  })
}

export async function completeCycleCount(
  tx: Prisma.TransactionClient,
  id: string,
  countNumber: string,
  warehouseId: string,
  countDate: Date,
  lineItems: Array<{
    id: string
    itemId: string
    countedQty: number | null
    variance: number | null
  }>,
) {
  const varianceLines = lineItems.filter(l => l.countedQty !== null && l.variance !== null && Number(l.variance) !== 0)

  await tx.stockLedger.createMany({
    data: varianceLines.map(line => ({
      itemId: line.itemId, warehouseId,
      transactionType: 'ADJUSTMENT', quantity: Number(line.variance),
      unitCost: 0, totalCost: 0,
      referenceType: 'CYCLE_COUNT', referenceId: id,
      notes: `Cycle Count ${countNumber}`,
      transactionDate: countDate,
    })),
  })

  for (const line of varianceLines) {
    await tx.warehouseStock.upsert({
      where: { warehouseId_itemId: { warehouseId, itemId: line.itemId } },
      create: { warehouseId, itemId: line.itemId, quantity: Number(line.variance), avgCost: 0 },
      update: { quantity: { increment: Number(line.variance) } },
    })
  }

  return tx.cycleCount.update({
    where: { id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  })
}

export function updateCycleCountItems(
  tx: Prisma.TransactionClient,
  updates: Array<{ id: string; countedQty: number }>,
  systemQtyMap: Map<string, number>,
) {
  return Promise.all(
    updates.map((u) =>
      tx.cycleCountItem.update({
        where: { id: u.id },
        data: { countedQty: u.countedQty, variance: u.countedQty - (systemQtyMap.get(u.id) ?? 0) },
      })
    ),
  )
}

export function updateCycleCountStatus(id: string, status: string) {
  return prisma.cycleCount.update({ where: { id }, data: { status: status as any } })
}

// ── Stock Transfers ──────────────────────────────────────────────────────

export function getStockTransfer(id: string) {
  return prisma.stockTransfer.findUnique({
    where: { id },
    include: { fromWarehouse: true, toWarehouse: true, lineItems: { include: { item: true } } },
  })
}

export async function postStockTransfer(
  tx: Prisma.TransactionClient,
  transfer: {
    id: string
    fromWarehouseId: string
    toWarehouseId: string
    transferDate: Date
    lineItems: Array<{ id: string; itemId: string; quantity: number | Prisma.Decimal; unitCost: number | Prisma.Decimal }>
    status: string
  },
) {
  if (transfer.status !== 'DRAFT' && transfer.status !== 'IN_TRANSIT')
    throw new Error('Cannot post in current status')

  const { decrementStock, incrementStock } = await import('@/lib/stock')
  for (const line of transfer.lineItems) {
    const qty = Number(line.quantity)
    const cost = Number(line.unitCost)
    await decrementStock(tx, line.itemId, transfer.fromWarehouseId, qty, {
      unitCost: cost,
      referenceType: 'TRANSFER', referenceId: transfer.id, transactionDate: transfer.transferDate,
    })
    await incrementStock(tx, line.itemId, transfer.toWarehouseId, qty, cost, {
      referenceType: 'TRANSFER', referenceId: transfer.id, transactionDate: transfer.transferDate,
    })
  }
  return tx.stockTransfer.update({ where: { id: transfer.id }, data: { status: 'COMPLETED' } })
}

export function cancelStockTransfer(id: string) {
  return prisma.stockTransfer.update({ where: { id }, data: { status: 'CANCELLED' } })
}

// ── Attributes ────────────────────────────────────────────────────────────

export function listAttributes() {
  return prisma.itemAttribute.findMany({
    include: { values: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { name: 'asc' },
  })
}

export async function createAttribute(data: { name: string; values?: Array<{ value: string; sortOrder?: number }> }) {
  const attr = await prisma.itemAttribute.create({
    data: { name: data.name, values: data.values ? { create: data.values } : undefined },
    include: { values: { orderBy: { sortOrder: 'asc' } } },
  })
  return attr
}

export async function updateAttributeAction(id: string, action: string, options: { value?: string; sortOrder?: number; valueId?: string; name?: string }) {
  if (action === 'rename' && options.name) {
    await prisma.itemAttribute.update({ where: { id }, data: { name: options.name } })
  } else if (action === 'add_value' && options.value) {
    await prisma.itemAttributeValue.create({ data: { attributeId: id, value: options.value, sortOrder: options.sortOrder ?? 0 } })
  } else if (action === 'delete_value' && options.valueId) {
    await prisma.itemAttributeValue.delete({ where: { id: options.valueId } })
  }
  return prisma.itemAttribute.findUnique({
    where: { id },
    include: { values: { orderBy: { sortOrder: 'asc' } } },
  })
}

export function deleteAttribute(id: string) {
  return prisma.itemAttribute.delete({ where: { id } })
}

// ── Batches ───────────────────────────────────────────────────────────────

export function listBatches(where: Record<string, unknown> = {}) {
  return prisma.inventoryBatch.findMany({
    where,
    include: { item: { select: { id: true, sku: true, name: true, uom: true, reorderPoint: true } } },
    orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
  })
}

export async function listLowStockItems() {
  const items = await prisma.item.findMany({
    where: { deletedAt: null, isActive: true },
    include: { batches: { where: { quantityOnHand: { gt: 0 } }, select: { quantityOnHand: true } }, category: { select: { name: true } } },
  })
  return items.map(item => ({
    id: item.id, sku: item.sku, name: item.name,
    category: item.category?.name ?? '—',
    reorderPoint: Number(item.reorderPoint),
    totalQty: item.batches.reduce((s, b) => s + Number(b.quantityOnHand), 0),
  })).filter(i => i.totalQty <= i.reorderPoint)
}

export async function createBatch(data: Record<string, unknown>) {
  const { expiryDate, manufacturingDate, receivedDate, ...rest } = data
  return prisma.inventoryBatch.create({
    data: {
      ...rest as any,
      manufacturingDate: manufacturingDate ? new Date(manufacturingDate as string) : null,
      expiryDate: expiryDate ? new Date(expiryDate as string) : null,
      receivedDate: receivedDate ? new Date(receivedDate as string) : new Date(),
    },
    include: { item: { select: { id: true, sku: true, name: true, packing: true } } },
  })
}

export async function adjustBatchStock(batchId: number, quantityChange: number, reason: string, adjustedBy: string) {
  const batch = await prisma.inventoryBatch.findUnique({ where: { id: batchId } })
  if (!batch) throw new Error('Batch not found')
  const newQty = Number(batch.quantityOnHand) + quantityChange
  if (newQty < 0) throw new Error('Adjustment would result in negative stock')
  await prisma.$transaction([
    prisma.inventoryBatch.update({ where: { id: batchId }, data: { quantityOnHand: newQty } }),
    prisma.stockAdjustment.create({ data: { batchId, quantityChange, reason, adjustedBy } }),
  ])
  return { newQty }
}

// ── Categories ────────────────────────────────────────────────────────────

export function listCategories() {
  return prisma.itemCategory.findMany({ orderBy: { name: 'asc' }, take: 100 })
}

export function createCategory(data: Record<string, unknown>) {
  return prisma.itemCategory.create({ data: data as any })
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export async function getInventoryDashboard() {
  const now = new Date()
  const [items, warehouseCount, recentTransfers, pendingTransfers] = await Promise.all([
    prisma.item.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, sku: true, reorderPoint: true, standardCost: true, categoryId: true, category: { select: { name: true } }, warehouseStocks: { select: { quantity: true, warehouse: { select: { name: true } } } } },
    }),
    prisma.warehouse.count({ where: { isActive: true } }),
    prisma.stockTransfer.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, transferNumber: true, status: true, createdAt: true, fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } } } }),
    prisma.stockTransfer.count({ where: { status: { in: ['DRAFT', 'IN_TRANSIT'] } } }),
  ])

  let totalStockValue = 0
  const itemsWithStock = items.map(item => {
    const currentStock = item.warehouseStocks.reduce((s, w) => s + Number(w.quantity), 0)
    totalStockValue += currentStock * Number(item.standardCost ?? 0)
    return { ...item, currentStock }
  })

  const lowStockItems = itemsWithStock.filter(i => Number(i.reorderPoint) > 0 && i.currentStock > 0 && i.currentStock <= Number(i.reorderPoint)).slice(0, 10).map(i => ({ id: i.id, name: i.name, sku: i.sku, currentStock: i.currentStock, reorderPoint: Number(i.reorderPoint), warehouse: i.warehouseStocks[0]?.warehouse?.name ?? 'Default' }))
  const outOfStockCount = itemsWithStock.filter(i => i.currentStock === 0).length

  const catMap: Record<string, { name: string; count: number; value: number }> = {}
  for (const item of itemsWithStock) {
    const catId = item.categoryId ?? 'uncategorized'
    const catName = item.category?.name ?? 'Uncategorized'
    if (!catMap[catId]) catMap[catId] = { name: catName, count: 0, value: 0 }
    catMap[catId].count += 1
    catMap[catId].value += item.currentStock * Number(item.standardCost ?? 0)
  }
  const categoryDistribution = Object.values(catMap).sort((a, b) => b.count - a.count).slice(0, 6)

  const stockMovements = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { month: d.toLocaleString('en-GB', { month: 'short', year: '2-digit' }), inbound: 0, outbound: 0 }
  })

  return {
    totalItems: items.length, totalStockValue, lowStockCount: lowStockItems.length, outOfStockCount,
    warehouseCount, pendingTransfers, stockMovements, lowStockItems,
    categoryDistribution,
    recentTransfers: recentTransfers.map(t => ({ id: t.id, transferNumber: t.transferNumber, fromWarehouse: t.fromWarehouse?.name ?? '—', toWarehouse: t.toWarehouse?.name ?? '—', status: t.status, createdAt: t.createdAt.toISOString() })),
    topMovingItems: [],
  }
}

// ── Item Import ───────────────────────────────────────────────────────────

export async function importItems(rows: Record<string, string>[]) {
  const categories = await prisma.itemCategory.findMany({ select: { id: true, name: true } })
  const catMap = Object.fromEntries(categories.map(c => [c.name.toLowerCase(), c.id]))
  const errors: string[] = []
  const validRows: Array<{ rowNum: number; data: Record<string, unknown> }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    if (!row['Item Name']) { errors.push(`Row ${rowNum}: Item Name is required`); continue }
    if (!row['UOM']) { errors.push(`Row ${rowNum}: UOM is required`); continue }
    const categoryName = row['Category'] ?? ''
    const categoryId = categoryName ? catMap[categoryName.toLowerCase()] : undefined
    if (categoryName && !categoryId) { errors.push(`Row ${rowNum}: Category "${categoryName}" not found`); continue }
    const { nextItemSku, nextItemBarcode } = await import('@/lib/codes')
    const sku = row['SKU']?.trim() || await nextItemSku()
    const barcode = row['Barcode']?.trim() || await nextItemBarcode()
    validRows.push({ rowNum, data: { sku, barcode, name: row['Item Name'], description: row['Description'] || undefined, uom: row['UOM'], packing: row['Packing'] || undefined, standardCost: parseFloat(row['Standard Cost'] ?? '0') || 0, sellingPrice: parseFloat(row['Selling Price'] ?? '0') || 0, reorderPoint: parseFloat(row['Reorder Point'] ?? '0') || 0, reorderQty: parseFloat(row['Reorder Qty'] ?? '0') || 0, ...(categoryId ? { categoryId } : {}) } })
  }

  let success = 0
  for (let i = 0; i < validRows.length; i += 100) {
    const chunk = validRows.slice(i, i + 100)
    try {
      await prisma.item.createMany({ data: chunk.map(r => r.data) as any })
      success += chunk.length
    } catch {
      for (const { rowNum, data } of chunk) {
        try { await prisma.item.create({ data: data as any }); success++ }
        catch (e2) { errors.push(`Row ${rowNum}: ${(e2 as Error).message.split('\n')[0]}`) }
      }
    }
  }
  return { success, failed: rows.length - success, errors }
}

// ── Item Variants ─────────────────────────────────────────────────────────

export function listVariants(itemId: string) {
  return prisma.itemVariant.findMany({
    where: { itemId },
    include: { attributes: { include: { attributeValue: { include: { attribute: true } } } } },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createVariant(itemId: string, data: { sku: string; barcode?: string | null; name?: string | null; sellingPrice?: number | null; standardCost?: number | null; isActive?: boolean; attributeValueIds: string[] }) {
  const { attributeValueIds, ...rest } = data
  return prisma.itemVariant.create({
    data: { ...rest, itemId, attributes: { create: attributeValueIds.map(avId => ({ attributeValueId: avId })) } },
    include: { attributes: { include: { attributeValue: { include: { attribute: true } } } } },
  })
}

export function updateVariant(variantId: string, itemId: string, data: Record<string, unknown>) {
  return prisma.itemVariant.update({
    where: { id: variantId, itemId },
    data: data as any,
    include: { attributes: { include: { attributeValue: { include: { attribute: true } } } } },
  })
}

export function deleteVariant(variantId: string, itemId: string) {
  return prisma.itemVariant.delete({ where: { id: variantId, itemId } })
}

// ── Serial Numbers ────────────────────────────────────────────────────────

export function listSerialNumbers(where: Record<string, unknown> = {}) {
  return prisma.serialNumber.findMany({
    where: where as any,
    include: { item: { select: { id: true, name: true, packing: true, sku: true } }, warehouse: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
}

export async function createSerialNumber(data: { serialCode?: string; itemId: string; warehouseId?: string | null; purchaseDate?: Date | null; warrantyExpiry?: Date | null; notes?: string | null }) {
  const { nextSerialCode } = await import('@/lib/codes')
  const code = data.serialCode?.trim() || await nextSerialCode()
  return prisma.serialNumber.create({
    data: { serialCode: code, itemId: data.itemId, warehouseId: data.warehouseId ?? null, purchaseDate: data.purchaseDate ?? null, warrantyExpiry: data.warrantyExpiry ?? null, notes: data.notes ?? null },
  })
}

export function updateSerialNumber(id: string, data: Record<string, unknown>) {
  const allowed: Record<string, unknown> = {}
  if (data.status !== undefined) allowed.status = data.status
  if (data.warehouseId !== undefined) allowed.warehouseId = data.warehouseId || null
  if (data.notes !== undefined) allowed.notes = data.notes
  if (data.warrantyExpiry !== undefined) allowed.warrantyExpiry = data.warrantyExpiry ? new Date(data.warrantyExpiry as string) : null
  return prisma.serialNumber.update({ where: { id }, data: allowed as any })
}

// ── Stock Transfers (list/create) ─────────────────────────────────────────

export function listStockTransfers() {
  return prisma.stockTransfer.findMany({
    include: { fromWarehouse: { select: { id: true, name: true } }, toWarehouse: { select: { id: true, name: true } }, lineItems: { include: { item: { select: { id: true, name: true, packing: true, sku: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

export async function createStockTransfer(data: { fromWarehouseId: string; toWarehouseId: string; transferDate: Date; notes?: string | null; lineItems: Array<{ itemId: string; quantity: number; unitCost?: number }> }) {
  const count = await prisma.stockTransfer.count()
  const transferNumber = `TRF-${String(count + 1).padStart(5, '0')}`
  return prisma.stockTransfer.create({
    data: {
      transferNumber,
      fromWarehouseId: data.fromWarehouseId,
      toWarehouseId: data.toWarehouseId,
      transferDate: data.transferDate,
      notes: data.notes ?? null,
      lineItems: { create: data.lineItems.map(l => ({ itemId: l.itemId, quantity: l.quantity, unitCost: l.unitCost ?? 0 })) },
    },
    include: { fromWarehouse: true, toWarehouse: true, lineItems: { include: { item: true } } },
  })
}

// ── UOM ───────────────────────────────────────────────────────────────────

export function listUOMs() {
  return prisma.unitOfMeasure.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] })
}

export function createUOM(data: Record<string, unknown>) {
  return prisma.unitOfMeasure.create({ data: data as any })
}

// ── Valuation ─────────────────────────────────────────────────────────────

export async function getInventoryValuation(warehouseId?: string | null, method = 'moving_average') {
  const stocks = await prisma.warehouseStock.findMany({
    where: { ...(warehouseId ? { warehouseId } : {}), quantity: { gt: 0 } },
    include: { item: { select: { id: true, name: true, packing: true, sku: true, uom: true, standardCost: true } }, warehouse: { select: { id: true, name: true } } },
    orderBy: [{ warehouse: { name: 'asc' } }, { item: { name: 'asc' } }],
  })

  const valuation = stocks.map(s => {
    const qty = Number(s.quantity)
    const unitCost = method === 'fifo' ? Number(s.item.standardCost) : Number(s.avgCost)
    const totalValue = qty * unitCost
    return { warehouseId: s.warehouseId, warehouseName: s.warehouse.name, itemId: s.itemId, sku: s.item.sku, itemName: s.item.name, uom: s.item.uom, quantity: qty, avgCost: Number(s.avgCost), standardCost: Number(s.item.standardCost), unitCost, totalValue, method }
  })

  const totalStockValue = valuation.reduce((sum, v) => sum + v.totalValue, 0)
  return { valuation, totalStockValue, method }
}

// ── Warehouses ────────────────────────────────────────────────────────────

export function listWarehouses() {
  return prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, take: 100 })
}

export function createWarehouse(data: Record<string, unknown>) {
  return prisma.warehouse.create({ data: data as any })
}

export function updateWarehouse(id: string, data: Record<string, unknown>) {
  return prisma.warehouse.update({ where: { id }, data: data as any })
}

export function deactivateWarehouse(id: string) {
  return prisma.warehouse.update({ where: { id }, data: { isActive: false } })
}
