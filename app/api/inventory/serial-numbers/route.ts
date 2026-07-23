import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialNumberSchema } from '@/lib/validations/inventory'
import { nextSerialCode } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('itemId')
  const status = searchParams.get('status')

  const serials = await prisma.serialNumber.findMany({
    where: {
      ...(itemId ? { itemId } : {}),
      ...(status ? { status: status as 'IN_STOCK' | 'SOLD' | 'RETURNED' | 'SCRAPPED' } : {}),
    },
    include: {
      item: { select: { id: true, name: true, packing: true, sku: true } },
      warehouse: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  return NextResponse.json({ success: true, data: serials })
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = serialNumberSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { serialCode, itemId, warehouseId, purchaseDate, warrantyExpiry, notes } = parsed.data
  try {
    const code = serialCode?.trim() ? serialCode.trim() : await nextSerialCode()
    const serial = await prisma.serialNumber.create({
      data: {
        serialCode: code,
        itemId,
        warehouseId: warehouseId || null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        notes,
      },
    })
    return NextResponse.json({ success: true, data: serial }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
