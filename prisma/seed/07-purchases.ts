import { PrismaClient } from '@prisma/client'
import { pick, randInt, randFloat, randDate, generatePONumber, generateGRNNumber } from './utils'

export async function seedPurchases(
  prisma: PrismaClient,
  vendorIdsByIndex: string[],
  itemIds: string[],
  warehouseIds: string[],
  companyId: string,
  userIds: string[],
): Promise<{
  poIds: string[]
  grnIds: string[]
  grnLineItemData: { itemId: string; warehouseId: string; acceptedQty: number; unitCost: number; poId: string; grnId: string }[]
}> {
  console.log('\n--- Seeding Purchase Orders & Goods Receipts ---')

  const poIds: string[] = []
  const grnIds: string[] = []
  const grnLineItemData: { itemId: string; warehouseId: string; acceptedQty: number; unitCost: number; poId: string; grnId: string }[] = []

  const poDateStart = new Date('2025-08-01')
  const poDateEnd = new Date('2026-06-30')

  let poCounter = 1
  let grnCounter = 1

  const activeVendors = vendorIdsByIndex.slice(0, 35)

  for (let v = 0; v < activeVendors.length; v++) {
    const vendorId = activeVendors[v]
    const numPOs = v % 10 === 0 ? 3 : randInt(1, 2)
    const vendorPOData: {
      poNum: string; poDate: Date; totalAmount: number; lineItems: { itemId: string; qty: number; unitPrice: number; lineTotal: number }[]
    }[] = []

    for (let p = 0; p < numPOs; p++) {
      const numLines = randInt(1, 3)
      const lineItems: { itemId: string; qty: number; unitPrice: number; lineTotal: number }[] = []
      let totalAmount = 0

      for (let l = 0; l < numLines; l++) {
        const itemIdx = randInt(0, itemIds.length - 1)
        const itemId = itemIds[itemIdx]
        const qty = randInt(10, 300)
        const unitPrice = randFloat(100, 30000, 0)
        const lineTotal = qty * unitPrice
        totalAmount += lineTotal
        lineItems.push({ itemId, qty, unitPrice, lineTotal })
      }

      const poDate = randDate(poDateStart, poDateEnd)
      const poNum = generatePONumber(poCounter++)
      vendorPOData.push({ poNum, poDate, totalAmount, lineItems })
    }

    const pos: { id: string; poDate: Date; lineItems: { id: string; itemId: string; qty: number; unitPrice: number; lineTotal: number }[] }[] = []

    for (const pod of vendorPOData) {
      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber: pod.poNum,
          vendorId,
          companyId,
          orderDate: pod.poDate,
          status: 'APPROVED',
          totalAmount: pod.totalAmount,
          taxAmount: 0,
          shippingCost: 0,
          grandTotal: pod.totalAmount,
          notes: `Bulk order`,
        },
      })
      poIds.push(po.id)

      const poLines: { id: string; itemId: string; qty: number; unitPrice: number }[] = []

      for (const li of pod.lineItems) {
        const pol = await prisma.pOLineItem.create({
          data: {
            poId: po.id,
            itemId: li.itemId,
            description: `Item ${li.itemId.slice(0, 8)}`,
            quantity: li.qty,
            uom: 'Piece',
            unitPrice: li.unitPrice,
            totalPrice: li.lineTotal,
          },
        })
        poLines.push({ id: pol.id, itemId: li.itemId, qty: li.qty, unitPrice: li.unitPrice })
      }

      pos.push({ id: po.id, poDate: pod.poDate, lineItems: poLines.map(l => ({ id: l.id, itemId: l.itemId, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.qty * l.unitPrice })) })
    }

    for (const p of pos) {
      const whId = pick(warehouseIds)
      const grnDate = randDate(p.poDate, new Date('2026-07-15'))
      const grnNum = generateGRNNumber(grnCounter++)

      const grn = await prisma.goodsReceiptNote.create({
        data: {
          grnNumber: grnNum,
          poId: p.id,
          companyId,
          receivedDate: grnDate,
          receivedById: pick(userIds),
        },
      })
      grnIds.push(grn.id)

      for (const [liIdx, line] of p.lineItems.entries()) {
        const acceptedQty = line.qty
        await prisma.gRNLineItem.create({
          data: {
            grnId: grn.id,
            poLineItemId: p.lineItems[liIdx].id,
            itemId: line.itemId,
            receivedQty: line.qty,
            acceptedQty,
            rejectedQty: 0,
            unitPrice: line.unitPrice,
            warehouseId: whId,
          },
        })
        grnLineItemData.push({
          itemId: line.itemId,
          warehouseId: whId,
          acceptedQty,
          unitCost: line.unitPrice,
          poId: p.id,
          grnId: grn.id,
        })
      }
    }

    if ((v + 1) % 10 === 0) process.stdout.write(` Vendors processed: ${v + 1}/${activeVendors.length}\n`)
  }

  console.log(` Purchase Orders: ${poIds.length}`)
  console.log(` GRNs: ${grnIds.length}`)
  console.log(` GRN Line Items: ${grnLineItemData.length}`)

  return { poIds, grnIds, grnLineItemData }
}
