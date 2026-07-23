import { PrismaClient } from '@prisma/client'

export async function seedStock(
  prisma: PrismaClient,
  grnData: { itemId: string; warehouseId: string; acceptedQty: number; unitCost: number; poId: string; grnId: string }[],
): Promise<void> {
  console.log('\n--- Seeding Stock Ledger & Warehouse Stock ---')

  const stockMap = new Map<string, { qty: number; totalCost: number }>()

  for (const gd of grnData) {
    const unitCost = gd.unitCost
    const totalCost = gd.acceptedQty * unitCost

    await prisma.stockLedger.create({
      data: {
        itemId: gd.itemId,
        warehouseId: gd.warehouseId,
        transactionType: 'IN',
        quantity: gd.acceptedQty,
        unitCost,
        totalCost,
        referenceType: 'GRN',
        referenceId: gd.grnId,
        transactionDate: new Date('2026-01-15'),
        notes: `Stock received via GRN`,
      },
    })

    const key = `${gd.itemId}:${gd.warehouseId}`
    const existing = stockMap.get(key) || { qty: 0, totalCost: 0 }
    stockMap.set(key, {
      qty: existing.qty + gd.acceptedQty,
      totalCost: existing.totalCost + totalCost,
    })
  }

  let upsertCount = 0
  for (const [key, val] of stockMap.entries()) {
    const [itemId, warehouseId] = key.split(':')
    const avgCost = val.qty > 0 ? Math.round(val.totalCost / val.qty) : 0
    await prisma.warehouseStock.upsert({
      where: { warehouseId_itemId: { warehouseId, itemId } },
      update: { quantity: { increment: val.qty }, avgCost },
      create: { warehouseId, itemId, quantity: val.qty, avgCost },
    })
    upsertCount++
  }

  console.log(` Stock Ledger entries: ${grnData.length}`)
  console.log(` Warehouse Stock records: ${upsertCount}`)
}
