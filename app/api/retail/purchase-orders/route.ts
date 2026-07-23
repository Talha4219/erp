import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { retailPoSchema } from '@/lib/validations/retail'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''

  try {
    const orders = await prisma.retailPurchaseOrder.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      include: {
        supplier: true,
        lineItems: { include: { product: true } },
        grns: true,
      },
      orderBy: { orderDate: 'desc' },
    })
    return NextResponse.json({ success: true, data: orders })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  const body = await req.json()
  const parsed = retailPoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const { lineItems, expectedDeliveryDate, ...poData } = parsed.data
    const totalCost = lineItems.reduce((sum, li) => sum + li.quantityOrdered * li.unitCostGbp, 0)

    const po = await prisma.retailPurchaseOrder.create({
      data: {
        ...poData,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        totalCostGbp: totalCost,
        lineItems: {
          create: lineItems.map((li) => ({
            productId: li.productId,
            quantityOrdered: li.quantityOrdered,
            unitCostGbp: li.unitCostGbp,
          })),
        },
      },
      include: { lineItems: true, supplier: true },
    })

    await prisma.auditLog.create({
      data: {
        userId: (session.user as { id: string }).id,
        action: 'CREATE',
        entity: 'RetailPurchaseOrder',
        entityId: String(po.id),
        newValues: { status: po.status, totalCostGbp: totalCost },
      },
    })

    return NextResponse.json({ success: true, data: po }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
