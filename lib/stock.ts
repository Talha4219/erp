import { Prisma } from '@prisma/client'
import { round2 } from './money'

export type TxClient = Prisma.TransactionClient

export interface StockOpOptions {
  referenceType?: string | null
  referenceId?: string | null
  notes?: string | null
  transactionDate?: Date
}

export function recalcAvgCost(
  currentQty: number,
  currentAvgCost: number,
  incomingQty: number,
  incomingUnitCost: number,
): number {
  const newTotalCost = currentQty * currentAvgCost + incomingQty * incomingUnitCost
  const newQty = currentQty + incomingQty
  if (newQty <= 0) return incomingUnitCost
  return round2(newTotalCost / newQty)
}

export async function getStockUnitCost(
  tx: TxClient,
  itemId: string,
  warehouseId: string,
): Promise<number> {
  const ws = await tx.warehouseStock.findUnique({
    where: { warehouseId_itemId: { warehouseId, itemId } },
    select: { avgCost: true },
  })
  if (ws) return Number(ws.avgCost)
  const lastLedger = await tx.stockLedger.findFirst({
    where: { itemId, warehouseId, unitCost: { gt: 0 } },
    orderBy: { transactionDate: 'desc' },
    select: { unitCost: true },
  })
  if (lastLedger) return Number(lastLedger.unitCost)
  const anyWarehouse = await tx.stockLedger.findFirst({
    where: { itemId, unitCost: { gt: 0 } },
    orderBy: { transactionDate: 'desc' },
    select: { unitCost: true },
  })
  return anyWarehouse ? Number(anyWarehouse.unitCost) : 0
}

export async function decrementStock(
  tx: TxClient,
  itemId: string,
  warehouseId: string,
  quantity: number,
  options?: StockOpOptions & { unitCost?: number },
): Promise<void> {
  const { count } = await tx.warehouseStock.updateMany({
    where: { warehouseId, itemId, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  })
  if (count !== 1) throw new Error(`Insufficient stock for item ${itemId} in warehouse ${warehouseId}`)
  const unitCost = options?.unitCost ?? await getStockUnitCost(tx, itemId, warehouseId)
  await tx.stockLedger.create({
    data: {
      itemId,
      warehouseId,
      transactionType: 'OUT',
      quantity: -quantity,
      unitCost,
      totalCost: round2(unitCost * quantity),
      referenceType: options?.referenceType ?? null,
      referenceId: options?.referenceId ?? null,
      notes: options?.notes ?? null,
      transactionDate: options?.transactionDate ?? new Date(),
    },
  })
}

export async function incrementStock(
  tx: TxClient,
  itemId: string,
  warehouseId: string,
  quantity: number,
  unitCost: number,
  options?: StockOpOptions,
): Promise<void> {
  const existing = await tx.warehouseStock.findUnique({
    where: { warehouseId_itemId: { warehouseId, itemId } },
  })
  const newAvgCost = existing
    ? recalcAvgCost(Number(existing.quantity), Number(existing.avgCost), quantity, unitCost)
    : unitCost
  await tx.warehouseStock.upsert({
    where: { warehouseId_itemId: { warehouseId, itemId } },
    create: { warehouseId, itemId, quantity, avgCost: newAvgCost },
    update: {
      quantity: { increment: quantity },
      avgCost: newAvgCost,
    },
  })
  await tx.stockLedger.create({
    data: {
      itemId,
      warehouseId,
      transactionType: 'IN',
      quantity,
      unitCost,
      totalCost: round2(unitCost * quantity),
      referenceType: options?.referenceType ?? null,
      referenceId: options?.referenceId ?? null,
      notes: options?.notes ?? null,
      transactionDate: options?.transactionDate ?? new Date(),
    },
  })
}

export async function selectWarehouse(
  tx: TxClient,
  itemId: string,
  preferredWarehouseId?: string | null,
): Promise<{ warehouseId: string; avgCost: number } | null> {
  if (preferredWarehouseId) {
    const at = await tx.warehouseStock.findUnique({
      where: { warehouseId_itemId: { warehouseId: preferredWarehouseId, itemId } },
    })
    if (at) return { warehouseId: preferredWarehouseId, avgCost: Number(at.avgCost) }
  }
  const top = await tx.warehouseStock.findFirst({
    where: { itemId },
    orderBy: { quantity: 'desc' },
  })
  if (!top) return null
  return { warehouseId: top.warehouseId, avgCost: Number(top.avgCost) }
}
