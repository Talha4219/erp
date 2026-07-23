import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth(async (_req: NextRequest, { params, session }: Params & { session: import('@/lib/api-middleware').AuthedSession }) => {
  if (!hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const item = await prisma.item.findUnique({ where: { id: params.id }, include: { category: true } })
  if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: { ...item, isActive: !item.deletedAt } })
})

export const PUT = withAuth(async (req: NextRequest, { params, session }: Params & { session: import('@/lib/api-middleware').AuthedSession }) => {
  if (!hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    // Whitelist Item columns — the form payload also carries non-column keys (e.g. warehouseId)
    const data: Record<string, unknown> = {}
    if (typeof body.sku === 'string' && body.sku.trim()) data.sku = body.sku.trim() // keep existing SKU if cleared
    if (typeof body.barcode === 'string' && body.barcode.trim()) data.barcode = body.barcode.trim() // keep existing barcode if cleared
    if (body.barcodeType !== undefined) data.barcodeType = body.barcodeType
    if (body.secondaryBarcode !== undefined) data.secondaryBarcode = typeof body.secondaryBarcode === 'string' && body.secondaryBarcode.trim() ? body.secondaryBarcode.trim() : null
    if (body.name !== undefined) data.name = body.name
    if (body.description !== undefined) data.description = body.description || null
    if (body.uom !== undefined) data.uom = body.uom
    if (body.packing !== undefined) data.packing = body.packing || null
    if (body.vatRate !== undefined) data.vatRate = body.vatRate
    if (body.categoryId !== undefined) data.categoryId = body.categoryId
    if (body.standardCost !== undefined) data.standardCost = body.standardCost
    if (body.sellingPrice !== undefined) data.sellingPrice = body.sellingPrice
    if (body.reorderPoint !== undefined) data.reorderPoint = body.reorderPoint
    if (body.reorderQty !== undefined) data.reorderQty = body.reorderQty
    if (body.expiryDate !== undefined) data.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.isSellable !== undefined) data.isSellable = body.isSellable
    if (body.isPurchasable !== undefined) data.isPurchasable = body.isPurchasable

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({ where: { id: params.id }, data })

      // Honour a warehouse choice: assign the item to the selected warehouse if it
      // isn't stocked there yet. Existing stock is left untouched — moving quantity
      // between warehouses is done through Transfers, not by editing the item.
      if (body.warehouseId) {
        await tx.warehouseStock.upsert({
          where: { warehouseId_itemId: { warehouseId: body.warehouseId, itemId: updated.id } },
          create: {
            warehouseId: body.warehouseId,
            itemId: updated.id,
            quantity: 0,
            avgCost: body.standardCost ?? Number(updated.standardCost) ?? 0,
          },
          update: {},
        })
      }
      return updated
    })

    return NextResponse.json({ success: true, data: item })
  } catch (err) {
    // P2002 = unique constraint violation (duplicate barcode or SKU)
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Barcode or SKU already assigned to another item' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: NextRequest, { params, session }: Params & { session: import('@/lib/api-middleware').AuthedSession }) => {
  if (!hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    await prisma.item.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true, data: null })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
