import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { salesOrderSchema } from '@/lib/validations/sales'
import { nextDocNumber } from '@/lib/services/numbering'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { getUserCompanyId, companyScope } from '@/lib/company-scope'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id!)
  try {
    const orders = await prisma.salesOrder.findMany({
      where: { deletedAt: null, ...companyScope(companyId) },
      include: { customer: { select: { id: true, name: true } }, lineItems: { include: { item: { select: { id: true, name: true, sku: true } } } } },
      orderBy: { orderDate: 'desc' },
      take: 100,
    })
    return NextResponse.json({ success: true, data: orders })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function postHandler(req: NextRequest, { session }: { session: import('@/lib/api-middleware').AuthedSession }) {
  const body = await req.json()
  const parsed = salesOrderSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { customerId, orderDate, deliveryDate, notes, lineItems } = parsed.data

  const processedItems = lineItems.map((li) => {
    const totalPrice = li.quantity * li.unitPrice * (1 - li.discount / 100) * (1 + li.taxRate / 100)
    return { ...li, totalPrice }
  })

  const subTotal = processedItems.reduce((s, li) => s + li.totalPrice, 0)
  const taxAmount = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice * li.taxRate / 100, 0)
  const discountAmount = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice * li.discount / 100, 0)
  const totalAmount = subTotal + taxAmount - discountAmount

  try {
    const soNumber = await nextDocNumber('sales_order')
    const companyId = await getUserCompanyId(session.user.id!)

    const order = await prisma.salesOrder.create({
      data: {
        soNumber,
        customerId,
        companyId: companyId ?? undefined,
        orderDate: new Date(orderDate),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        notes,
        subTotal,
        taxAmount,
        discountAmount,
        totalAmount,
        lineItems: { create: processedItems },
      },
      include: { customer: { select: { id: true, name: true } }, lineItems: { include: { item: { select: { id: true, name: true, sku: true } } } } },
    })

    // Check inventory availability for items with an itemId
    const shortfall: Array<{ itemId: string; description: string; qty: number; available: number }> = []
    const itemIds = [...new Set(lineItems.filter(li => li.itemId).map(li => li.itemId!))]
    const allStocks = await prisma.warehouseStock.findMany({
      where: { itemId: { in: itemIds } },
    })
    const stockByItem = new Map<string, typeof allStocks>()
    for (const s of allStocks) {
      if (!stockByItem.has(s.itemId)) stockByItem.set(s.itemId, [])
      stockByItem.get(s.itemId)!.push(s)
    }

    for (const li of lineItems) {
      if (!li.itemId) continue

      const warehouseStocks = stockByItem.get(li.itemId) || []
      const totalAvailable = warehouseStocks.reduce((s, ws) => s + Number(ws.quantity), 0)
      const needed = Number(li.quantity)

      if (needed > totalAvailable) {
        shortfall.push({
          itemId: li.itemId,
          description: li.description,
          qty: needed,
          available: totalAvailable,
        })
      }
    }

    if (shortfall.length > 0) {
      return NextResponse.json({
        success: true,
        data: {
          ...order,
          shortfall,
        },
      }, { status: 201 })
    }

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const POST = withRateLimit(withAudit(withAuth(postHandler) as Parameters<typeof withAudit>[0], 'SalesOrder'))
