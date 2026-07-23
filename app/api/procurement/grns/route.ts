import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { eventBus } from '@/lib/events/bus'
import { nextDocNumber } from '@/lib/services/numbering'
import { getUserCompanyId, companyScope } from '@/lib/company-scope'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id!)
  try {
    const grns = await prisma.goodsReceiptNote.findMany({
      where: companyScope(companyId),
      include: { po: { include: { vendor: { select: { name: true } } } }, _count: { select: { lineItems: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(apiResponse(grns))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  try {
    const body = await req.json()
    const { poId, receivedDate, receivedById, notes, lineItems = [] } = body
    if (!poId || !receivedDate || !receivedById) return NextResponse.json(apiError('poId, receivedDate, receivedById required'), { status: 400 })
    const grnNumber = await nextDocNumber('grn')
    const companyId = await getUserCompanyId(session.user.id!)
    const today = new Date(receivedDate)

    // Validate poLineItemIds — strip any that don't exist in the DB to avoid FK violations
    type RawLine = { poLineItemId?: string; receivedQty: number; acceptedQty: number; rejectedQty: number; unitPrice: number; itemId?: string; warehouseId?: string }
    const rawLines = lineItems as RawLine[]
    const sentIds = [...new Set(rawLines.map(l => l.poLineItemId).filter(Boolean))] as string[]
    const existingPoItems = sentIds.length
      ? await prisma.pOLineItem.findMany({ where: { id: { in: sentIds } }, select: { id: true } })
      : []
    const validIdSet = new Set(existingPoItems.map(p => p.id))
    const safeLines = rawLines.map(l => ({
      poLineItemId: l.poLineItemId && validIdSet.has(l.poLineItemId) ? l.poLineItemId : undefined,
      itemId: l.itemId,
      receivedQty: l.receivedQty,
      acceptedQty: l.acceptedQty,
      rejectedQty: l.rejectedQty,
      unitPrice: l.unitPrice,
      warehouseId: l.warehouseId,
    }))

    const grn = await prisma.$transaction(async (tx) => {
      const g = await tx.goodsReceiptNote.create({
        data: { grnNumber, poId, companyId: companyId ?? undefined, receivedDate: today, receivedById, notes,
          lineItems: safeLines.length ? { createMany: { data: safeLines } } : undefined },
        include: { lineItems: true },
      })

      // Update PO status
      const allGRNs = await tx.gRNLineItem.findMany({ where: { grn: { poId } } })
      const poItems = await tx.pOLineItem.findMany({ where: { poId } })
      const totalOrdered = poItems.reduce((s, i) => s + Number(i.quantity), 0)
      const totalReceived = allGRNs.reduce((s, i) => s + Number(i.receivedQty), 0)
      const poStatus = totalReceived >= totalOrdered ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED'
      await tx.purchaseOrder.update({ where: { id: poId }, data: { status: poStatus } })

      // Update WarehouseStock and StockLedger for each received line item
      const stockLines = g.lineItems.filter((li): li is typeof li & { itemId: string; warehouseId: string } => !!li.itemId && !!li.warehouseId && Number(li.acceptedQty) > 0)
      for (const li of stockLines) {
        await tx.warehouseStock.upsert({
          where: { warehouseId_itemId: { warehouseId: li.warehouseId, itemId: li.itemId } },
          update: { quantity: { increment: li.acceptedQty } },
          create: { warehouseId: li.warehouseId, itemId: li.itemId, quantity: li.acceptedQty, avgCost: li.unitPrice },
        })
      }
      await tx.stockLedger.createMany({
        data: stockLines.map(li => ({
          itemId: li.itemId,
          warehouseId: li.warehouseId,
          transactionType: 'IN',
          quantity: li.acceptedQty,
          unitCost: li.unitPrice,
          totalCost: Number(li.acceptedQty) * Number(li.unitPrice),
          referenceType: 'GRN',
          referenceId: g.id,
          notes: `GRN ${grnNumber}`,
          transactionDate: today,
        })),
      })

      return g
    })

    // After transaction: if this PO's PR has a sourceSoId and SO is PENDING_PO, attempt auto-reserve
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { pr: { select: { sourceSoId: true } } },
    })
    const sourceSoId = po?.pr?.sourceSoId
    if (sourceSoId) {
      const so = await prisma.salesOrder.findUnique({
        where: { id: sourceSoId },
        include: { lineItems: true },
      })
      if (so?.status === 'PENDING_PO') {
        // Re-run inventory check logic inline
        let canReserve = true
        const reservations: Array<{ soId: string; soItemId: string; itemId: string; warehouseId: string; reservedQty: number }> = []

        const itemIds = [...new Set(so.lineItems.filter(li => li.itemId).map(li => li.itemId!))]
        const allStocks = await prisma.warehouseStock.findMany({
          where: { itemId: { in: itemIds } },
        })
        const stockByItem = new Map<string, typeof allStocks>()
        for (const s of allStocks) {
          if (!stockByItem.has(s.itemId)) stockByItem.set(s.itemId, [])
          stockByItem.get(s.itemId)!.push(s)
        }

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

        if (canReserve) {
          await prisma.$transaction([
            ...reservations.map((r) => prisma.stockReservation.create({ data: r })),
            prisma.salesOrder.update({ where: { id: sourceSoId }, data: { status: 'RESERVED' } }),
          ])
        }
      }
    }

    // Emit event for auto AP journal (best-effort — after transaction commits)
    const totalAmount = grn.lineItems.reduce(
      (s, li) => s + Number(li.acceptedQty) * Number(li.unitPrice), 0
    )
    const fullPo = await prisma.purchaseOrder.findUnique({
      where: { id: poId }, select: { vendorId: true }
    })
    if (fullPo) {
      eventBus.emit('grn.posted', {
        grnId: grn.id, poId, vendorId: fullPo.vendorId,
        totalAmount, userId: receivedById,
      })
    }

    return NextResponse.json(apiResponse(grn), { status: 201 })
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
