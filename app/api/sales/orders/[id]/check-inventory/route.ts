import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nextPurchaseRequestNumber } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'

type Params = { params: { id: string } }

export const POST = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  try {
    const order = await prisma.salesOrder.findUnique({
      where: { id: params.id },
      include: { lineItems: { include: { item: true } } },
    })
    if (!order) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    if (order.status !== 'CONFIRMED')
      return NextResponse.json({ success: false, error: 'Order must be CONFIRMED before inventory check' }, { status: 400 })

    // Release any prior ACTIVE reservations for this SO (idempotent re-check)
    await prisma.stockReservation.updateMany({
      where: { soId: params.id, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    })

    // Build shortfall list for items with itemId
    const shortfall: Array<{ itemId: string; description: string; qty: number; uom: string; soItemId: string }> = []

    const reservationsToCreate: Array<{
      soId: string; soItemId: string; itemId: string; warehouseId: string; reservedQty: number
    }> = []

    for (const li of order.lineItems) {
      if (!li.itemId) continue
      const needed = Number(li.quantity)

      // Sum available stock across all warehouses, minus already reserved
      const warehouseStocks = await prisma.warehouseStock.findMany({
        where: { itemId: li.itemId },
        include: { warehouse: { select: { id: true } } },
      })

      const alreadyReserved = await prisma.stockReservation.aggregate({
        where: { itemId: li.itemId, status: 'ACTIVE' },
        _sum: { reservedQty: true },
      })
      const reservedElsewhere = Number(alreadyReserved._sum.reservedQty ?? 0)

      // Greedy allocation across warehouses
      let remaining = needed
      for (const ws of warehouseStocks) {
        if (remaining <= 0) break
        const available = Math.max(0, Number(ws.quantity) - (ws.warehouseId === warehouseStocks[0]?.warehouseId ? reservedElsewhere : 0))
        const allocate = Math.min(available, remaining)
        if (allocate > 0) {
          reservationsToCreate.push({
            soId: params.id,
            soItemId: li.id,
            itemId: li.itemId,
            warehouseId: ws.warehouseId,
            reservedQty: allocate,
          })
          remaining -= allocate
        }
      }

      if (remaining > 0) {
        shortfall.push({
          itemId: li.itemId,
          description: li.description,
          qty: remaining,
          uom: li.item?.uom ?? 'EA',
          soItemId: li.id,
        })
      }
    }

    if (shortfall.length === 0) {
      // All stock available — create reservations and move to RESERVED
      await prisma.$transaction([
        ...reservationsToCreate.map((r) =>
          prisma.stockReservation.create({ data: r })
        ),
        prisma.salesOrder.update({
          where: { id: params.id },
          data: { status: 'RESERVED' },
        }),
      ])
      return NextResponse.json({ success: true, data: { status: 'RESERVED', shortfall: [] } })
    } else {
      // Stock insufficient — create PR for shortfalls and move to PENDING_PO
      const prNumber = await nextPurchaseRequestNumber()
      const totalAmount = shortfall.reduce((s, i) => s + i.qty * 0, 0) // estimated — no unit price here

      const pr = await prisma.purchaseRequisition.create({
        data: {
          prNumber,
          requestedById: (session.user as { id?: string })?.id ?? 'system',
          sourceSoId: params.id,
          requiredDate: order.deliveryDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          notes: `Auto-generated from Sales Order ${order.soNumber} — stock shortfall`,
          totalAmount,
          lineItems: {
            create: shortfall.map((s) => ({
              itemId: s.itemId,
              description: s.description,
              quantity: s.qty,
              uom: s.uom,
              estimatedUnitPrice: 0,
              totalPrice: 0,
            })),
          },
        },
      })

      await prisma.salesOrder.update({
        where: { id: params.id },
        data: { status: 'PENDING_PO' },
      })

      return NextResponse.json({
        success: true,
        data: { status: 'PENDING_PO', shortfall, prId: pr.id, prNumber: pr.prNumber },
      })
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
