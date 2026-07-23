import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stockAdjustmentSchema } from '@/lib/validations/inventory'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('itemId')
  const warehouseId = searchParams.get('warehouseId')

  try {
    const ledger = await prisma.stockLedger.findMany({
      where: {
        ...(itemId ? { itemId } : {}),
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: { item: { select: { id: true, name: true, sku: true } }, warehouse: { select: { id: true, name: true } } },
      orderBy: { transactionDate: 'desc' },
      take: 200,
    })
    return NextResponse.json({ success: true, data: ledger })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = stockAdjustmentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { itemId, warehouseId, transactionType, quantity, unitCost = 0, notes, transactionDate } = parsed.data
  if (transactionType === 'IN' && Number(quantity) <= 0) return NextResponse.json({ success: false, error: 'IN quantity must be positive' }, { status: 400 })
  if (transactionType === 'OUT' && Number(quantity) >= 0) return NextResponse.json({ success: false, error: 'OUT quantity must be negative' }, { status: 400 })
  const totalCost = Math.abs(quantity) * unitCost

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const ledger = await tx.stockLedger.create({
        data: {
          itemId,
          warehouseId,
          transactionType,
          quantity,
          unitCost,
          totalCost,
          notes,
          transactionDate: new Date(transactionDate),
        },
      })

      await tx.warehouseStock.upsert({
        where: { warehouseId_itemId: { warehouseId: warehouseId!, itemId } },
        create: { warehouseId: warehouseId!, itemId, quantity, avgCost: unitCost },
        update: { quantity: { increment: quantity } },
      })

      return ledger
    })
    return NextResponse.json({ success: true, data: entry }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
