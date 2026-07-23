import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nextDocNumber } from '@/lib/services/numbering'
import { getUserCompanyId, companyScope } from '@/lib/company-scope'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id!)
  const pos = await prisma.purchaseOrder.findMany({
    where: { deletedAt: null, ...companyScope(companyId) },
    include: { vendor: { select: { id: true, name: true, vendorCode: true } }, lineItems: true },
    orderBy: { orderDate: 'desc' },
    take: 100,
  })
  return NextResponse.json({ success: true, data: pos })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  try {
    const body = await req.json()
    const { lineItems = [], ...poData } = body

    const poNumber = await nextDocNumber('purchase_order')
    const companyId = await getUserCompanyId(session.user.id!)

    if (poData.orderDate) poData.orderDate = new Date(poData.orderDate).toISOString()
    if (poData.deliveryDate) poData.deliveryDate = new Date(poData.deliveryDate).toISOString()
    if (poData.expectedDelivery) poData.expectedDelivery = new Date(poData.expectedDelivery).toISOString()

    type LineItem = { quantity: number; unitPrice: number; taxRate?: number; [k: string]: unknown }
    const processedItems = (lineItems as LineItem[]).map((li) => ({
      ...li,
      totalPrice: li.quantity * li.unitPrice * (1 + (li.taxRate ?? 0) / 100),
    }))
    const totalAmount = processedItems.reduce((s, li) => s + (li.totalPrice as number), 0)
    const taxAmount = (lineItems as LineItem[]).reduce(
      (s, li) => s + li.quantity * li.unitPrice * ((li.taxRate ?? 0) / 100), 0
    )
    const shippingCost = Number(poData.shippingCost ?? 0)
    const grandTotal = totalAmount + shippingCost

    const po = await prisma.purchaseOrder.create({
      data: {
        ...poData,
        poNumber,
        companyId: companyId ?? undefined,
        totalAmount,
        taxAmount,
        shippingCost,
        grandTotal,
        ...(processedItems.length > 0 && { lineItems: { create: processedItems } }),
      },
    })

    // Notify procurement managers a new PO needs approval
    if (po.vendorId) {
      const { eventBus: eb } = await import('@/lib/events/bus')
      eb.emit('po.created', {
        poId: po.id,
        poNumber,
        vendorId: po.vendorId,
        grandTotal,
        userId: session.user.id!,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, data: po }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

