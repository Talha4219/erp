import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const warehouseId = searchParams.get('warehouseId')
  const method = searchParams.get('method') ?? 'moving_average' // 'fifo' | 'moving_average'

  try {
    const stocks = await prisma.warehouseStock.findMany({
      where: {
        ...(warehouseId ? { warehouseId } : {}),
        quantity: { gt: 0 },
      },
      include: {
        item: { select: { id: true, name: true, packing: true, sku: true, uom: true, standardCost: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: [{ warehouse: { name: 'asc' } }, { item: { name: 'asc' } }],
    })

    const valuation = stocks.map((s) => {
      const qty = Number(s.quantity)
      const unitCost = method === 'fifo' ? Number(s.item.standardCost) : Number(s.avgCost)
      const totalValue = qty * unitCost
      return {
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        itemId: s.itemId,
        sku: s.item.sku,
        itemName: s.item.name,
        uom: s.item.uom,
        quantity: qty,
        avgCost: Number(s.avgCost),
        standardCost: Number(s.item.standardCost),
        unitCost,
        totalValue,
        method,
      }
    })

    const totalStockValue = valuation.reduce((sum, v) => sum + v.totalValue, 0)
    return NextResponse.json({ success: true, data: { valuation, totalStockValue, method } })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
