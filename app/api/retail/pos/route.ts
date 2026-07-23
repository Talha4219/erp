import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { getStripe, stripeBreaker } from '@/lib/stripe'
import { posOrderSchema } from '@/lib/validations/retail'
import { eventBus } from '@/lib/events/bus'
import { registerEventHandlers } from '@/lib/events/handlers'

registerEventHandlers()

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const orderId = searchParams.get('orderId')

  try {
    if (orderId) {
      const order = await prisma.salesOrderV2.findFirst({
        where: { id: orderId },
        include: {
          customer: true,
          lineItems: { include: { item: true } },
          payments: true,
        },
      })
      if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
      return NextResponse.json({ success: true, data: order })
    }

    const whereDate = date
      ? { orderDate: { gte: new Date(date + 'T00:00:00Z'), lte: new Date(date + 'T23:59:59Z') } }
      : {}

    const orders = await prisma.salesOrderV2.findMany({
      where: whereDate,
      include: { lineItems: { include: { item: true } }, payments: true },
      orderBy: { orderDate: 'desc' },
      take: 50,
    })
    return NextResponse.json({ success: true, data: orders })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = posOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { customerId, paymentMethod, stripePaymentIntentId, lineItems } = parsed.data

  try {
    const itemIds = Array.from(new Set(lineItems.map((li) => li.itemId)))
    const items = await prisma.item.findMany({ where: { id: { in: itemIds }, deletedAt: null } })
    const itemById = new Map(items.map((i) => [i.id, i]))
    const settings = await prisma.storeSettings.findUnique({ where: { id: 'store' } })

    const computedLines = lineItems.map((li) => {
      const item = itemById.get(li.itemId)
      if (!item) throw new Error(`Item ${li.itemId} not found`)
      if (!item.isActive || !item.isSellable) throw new Error(`${item.name} is not available for sale`)
      const unitPrice = Number(item.sellingPrice)
      const vatRate = Number(item.vatRate)
      const gross = round2(unitPrice * li.quantity)
      const discount = Math.min(round2(li.lineDiscountGbp), gross)
      const net = round2(gross - discount)
      const vat = round2(net * vatRate)
      return {
        itemId: li.itemId,
        itemName: item.name,
        quantity: li.quantity,
        unitPrice,
        discount,
        taxRate: vatRate,
        _net: net,
        _vat: vat,
      }
    })

    const discountAmount = round2(computedLines.reduce((s: number, l: any) => s + l.discount, 0))
    const subTotal = round2(computedLines.reduce((s: number, l: any) => s + l._net, 0))
    const taxAmount = round2(computedLines.reduce((s: number, l: any) => s + l._vat, 0))
    const totalAmount = round2(subTotal + taxAmount)

    let stripePaymentStatus: string | undefined
    if (paymentMethod === 'Card' && stripePaymentIntentId) {
      const pi = await stripeBreaker.call(() =>
        getStripe().paymentIntents.retrieve(stripePaymentIntentId)
      )
      if (pi.status !== 'succeeded') {
        throw new Error(`Card payment not completed (status: ${pi.status})`)
      }
      const chargedAmount = (pi.amount_received ?? 0) / 100
      if (Math.abs(chargedAmount - totalAmount) > 0.01) {
        throw new Error(`Payment amount mismatch: charged ${chargedAmount}, expected ${totalAmount}`)
      }
      stripePaymentStatus = 'succeeded'
    }

    const stockMoves: { itemId: string; warehouseId: string; quantity: number; unitCost: number }[] = []

    const orderNumber = `POS-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const order = await prisma.$transaction(async (tx) => {
      stockMoves.length = 0

      for (const l of computedLines) {
        const item = itemById.get(l.itemId)!
        let warehouseId = settings?.posWarehouseId ?? null
        let unitCost = Number(item.standardCost)
        if (warehouseId) {
          const at = await tx.warehouseStock.findUnique({
            where: { warehouseId_itemId: { warehouseId, itemId: l.itemId } },
          })
          if (!at) warehouseId = null
          else unitCost = Number(at.avgCost)
        }
        if (!warehouseId) {
          const top = await tx.warehouseStock.findFirst({
            where: { itemId: l.itemId }, orderBy: { quantity: 'desc' },
          })
          warehouseId = top?.warehouseId ?? null
          if (top) unitCost = Number(top.avgCost)
        }
        if (!warehouseId) throw new Error(`No stock location for ${item.name}`)

        const dec = await tx.warehouseStock.updateMany({
          where: { warehouseId, itemId: l.itemId, quantity: { gte: l.quantity } },
          data: { quantity: { decrement: l.quantity } },
        })
        if (dec.count !== 1) throw new Error(`Insufficient stock for ${item.name}`)

        stockMoves.push({ itemId: l.itemId, warehouseId, quantity: l.quantity, unitCost })
      }

      const newOrder = await tx.salesOrderV2.create({
        data: {
          orderNumber,
          channel: 'POS',
          orderType: customerId ? 'CREDIT' : 'CASH',
          workflowStatus: 'COMPLETED',
          paymentStatus: 'PAID',
          fulfillmentStatus: 'PENDING',
          orderDate: new Date(),
          subTotal,
          taxAmount,
          discountAmount,
          totalAmount,
          stripePaymentIntentId: stripePaymentIntentId ?? null,
          stripePaymentStatus,
          lineItems: {
            create: computedLines.map((l) => {
              const totalPrice = round2((l.unitPrice * l.quantity - l.discount) * (1 + l.taxRate))
              return {
                itemId: l.itemId,
                description: l.itemName,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discount: l.discount,
                taxRate: l.taxRate,
                totalPrice,
              }
            }),
          },
          payments: {
            create: {
              method: paymentMethod,
              amount: totalAmount,
              status: 'COMPLETED',
              paidAt: new Date(),
            },
          },
        },
        include: { lineItems: true, payments: true },
      })

      const saleDate = new Date()
      await tx.stockLedger.createMany({
        data: stockMoves.map(m => ({
          itemId: m.itemId,
          warehouseId: m.warehouseId,
          transactionType: 'OUT',
          quantity: -m.quantity,
          unitCost: m.unitCost,
          totalCost: round2(m.unitCost * m.quantity),
          referenceType: 'POS',
          referenceId: newOrder.id,
          notes: `POS sale #${newOrder.id}`,
          transactionDate: saleDate,
        })),
      })

      if (customerId) {
        const pointsEarned = Math.floor(totalAmount)
        await tx.retailCustomer.update({
          where: { id: Number(customerId) },
          data: { loyaltyPointsBalance: { increment: pointsEarned } },
        })
      }

      return newOrder
    }, { isolationLevel: 'Serializable' })

    const totalCost = round2(stockMoves.reduce((s: number, m: any) => s + m.unitCost * m.quantity, 0))
    eventBus.emit('pos.sale_completed', {
      orderId: order.id,
      netTotal: subTotal,
      vatAmount: taxAmount,
      grandTotal: totalAmount,
      totalCost,
      paymentMethod,
      userId: session.user.id!,
    })

    if (stripePaymentIntentId) {
      stripeBreaker.call(() =>
        getStripe().paymentIntents.update(stripePaymentIntentId, {
          metadata: { posOrderId: order.id },
        })
      ).catch(() => {})
    }

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 400 })
  }
})
