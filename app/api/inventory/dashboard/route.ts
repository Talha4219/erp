import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModuleAccess } from '@/lib/authz'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'inventory')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const now = new Date()

    const [items, warehouseCount, recentTransfers, pendingTransfers] = await Promise.all([
      prisma.item.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          id: true, name: true, sku: true, reorderPoint: true, standardCost: true,
          categoryId: true, category: { select: { name: true } },
          warehouseStocks: { select: { quantity: true, warehouse: { select: { name: true } } } },
        },
      }),
      prisma.warehouse.count({ where: { isActive: true } }),
      prisma.stockTransfer.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, transferNumber: true, status: true, createdAt: true,
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
        },
      }),
      prisma.stockTransfer.count({ where: { status: { in: ['DRAFT', 'IN_TRANSIT'] } } }),
    ])

    let totalStockValue = 0
    const itemsWithStock = items.map(item => {
      const currentStock = item.warehouseStocks.reduce((s, w) => s + Number(w.quantity), 0)
      totalStockValue += currentStock * Number(item.standardCost ?? 0)
      return { ...item, currentStock }
    })

    const lowStockItems = itemsWithStock
      .filter(i => Number(i.reorderPoint) > 0 && i.currentStock > 0 && i.currentStock <= Number(i.reorderPoint))
      .slice(0, 10)
      .map(i => ({
        id: i.id, name: i.name, sku: i.sku, currentStock: i.currentStock,
        reorderPoint: Number(i.reorderPoint),
        warehouse: i.warehouseStocks[0]?.warehouse?.name ?? 'Default',
      }))

    const outOfStockCount = itemsWithStock.filter(i => i.currentStock === 0).length

    // Category distribution
    const catMap: Record<string, { name: string; count: number; value: number }> = {}
    for (const item of itemsWithStock) {
      const catId = item.categoryId ?? 'uncategorized'
      const catName = item.category?.name ?? 'Uncategorized'
      if (!catMap[catId]) catMap[catId] = { name: catName, count: 0, value: 0 }
      catMap[catId].count += 1
      catMap[catId].value += item.currentStock * Number(item.standardCost ?? 0)
    }
    const categoryDistribution = Object.values(catMap).sort((a, b) => b.count - a.count).slice(0, 6)

    // Stub monthly movements (stock ledger query would be more accurate but expensive)
    const stockMovements = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        month: d.toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
        inbound: 0,
        outbound: 0,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        totalItems: items.length,
        totalStockValue,
        lowStockCount: lowStockItems.length,
        outOfStockCount,
        warehouseCount,
        pendingTransfers,
        stockMovements,
        lowStockItems,
        categoryDistribution,
        recentTransfers: recentTransfers.map(t => ({
          id: t.id, transferNumber: t.transferNumber,
          fromWarehouse: t.fromWarehouse?.name ?? '—',
          toWarehouse: t.toWarehouse?.name ?? '—',
          status: t.status, createdAt: t.createdAt.toISOString(),
        })),
        topMovingItems: [],
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
