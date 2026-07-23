import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stockTransferSchema } from '@/lib/validations/inventory'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  const transfers = await prisma.stockTransfer.findMany({
    include: {
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
      lineItems: { include: { item: { select: { id: true, name: true, packing: true, sku: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ success: true, data: transfers })
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = stockTransferSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { fromWarehouseId, toWarehouseId, transferDate, notes, lineItems } = parsed.data
  if (fromWarehouseId === toWarehouseId)
    return NextResponse.json({ success: false, error: 'Source and destination warehouses must differ' }, { status: 400 })

  const count = await prisma.stockTransfer.count()
  const transferNumber = `TRF-${String(count + 1).padStart(5, '0')}`

  try {
    const transfer = await prisma.stockTransfer.create({
      data: {
        transferNumber,
        fromWarehouseId,
        toWarehouseId,
        transferDate: new Date(transferDate),
        notes,
        lineItems: { create: lineItems.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitCost: l.unitCost ?? 0 })) },
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        lineItems: { include: { item: true } },
      },
    })
    return NextResponse.json({ success: true, data: transfer }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
