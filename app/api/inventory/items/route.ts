import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nextItemSku, nextItemBarcode } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest) => {
  const params = new URL(req.url).searchParams
  const search = params.get('search') ?? ''
  // Exact-match scan lookup: ?barcode=… checks barcode, then secondary barcode, then SKU
  const barcode = params.get('barcode') ?? ''
  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      ...(barcode
        ? { OR: [{ barcode }, { secondaryBarcode: barcode }, { sku: barcode }] }
        : search && {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search } },
            ],
          }),
    },
    include: {
      category: { select: { id: true, name: true } },
      warehouseStocks: { include: { warehouse: { select: { id: true, name: true } } } },
    },
    orderBy: [{ expiryDate: 'asc' }, { name: 'asc' }],
    take: 200,
  })
  return NextResponse.json({ success: true, data: items.map((i) => ({ ...i, isActive: i.isActive })) })
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()

    // Item creation and the opening-stock write must succeed or fail together —
    // otherwise a failure in the warehouse/ledger step (bad warehouseId, DB hiccup)
    // leaves an orphan Item behind, and because SKU/barcode are freshly generated
    // per attempt, a retry doesn't hit the 409 dedupe path — it silently creates
    // another ghost item every time the user resubmits.
    const item = await prisma.$transaction(async (tx) => {
      const sku = typeof body.sku === 'string' && body.sku.trim() ? body.sku.trim() : await nextItemSku()
      const created = await tx.item.create({
        data: {
          sku,
          barcode: typeof body.barcode === 'string' && body.barcode.trim() ? body.barcode.trim() : await nextItemBarcode(),
          barcodeType: body.barcodeType ?? 'CODE128',
          secondaryBarcode: typeof body.secondaryBarcode === 'string' && body.secondaryBarcode.trim() ? body.secondaryBarcode.trim() : null,
          name: body.name,
          description: body.description ?? null,
          uom: body.uom ?? 'EA',
          packing: body.packing || null,
          vatRate: body.vatRate ?? 0.2,
          standardCost: body.standardCost ?? 0,
          sellingPrice: body.sellingPrice ?? 0,
          reorderPoint: body.reorderPoint ?? 0,
          reorderQty: body.reorderQty ?? 0,
          expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
          categoryId: body.categoryId,
          isSellable: body.isSellable ?? true,
          isPurchasable: body.isPurchasable ?? true,
        },
      })

      if (body.warehouseId) {
        const initialQty = Number(body.quantity) > 0 ? Number(body.quantity) : 0
        await tx.warehouseStock.upsert({
          where: { warehouseId_itemId: { warehouseId: body.warehouseId, itemId: created.id } },
          create: { warehouseId: body.warehouseId, itemId: created.id, quantity: initialQty, avgCost: initialQty > 0 ? body.standardCost ?? 0 : 0 },
          update: {},
        })
        if (initialQty > 0) {
          const cost = Number(body.standardCost) || 0
          await tx.stockLedger.create({
            data: {
              itemId: created.id,
              warehouseId: body.warehouseId,
              transactionType: 'IN',
              quantity: initialQty,
              unitCost: cost,
              totalCost: initialQty * cost,
              referenceType: 'INITIAL_STOCK',
              referenceId: created.id,
              notes: `Opening stock for ${created.name}`,
              transactionDate: new Date(),
            },
          })
        }
      }

      return created
    })
    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (err) {
    // P2002 = unique constraint violation (duplicate barcode or SKU)
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Barcode or SKU already assigned to another item' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
