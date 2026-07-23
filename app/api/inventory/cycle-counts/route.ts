import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cycleCountSchema } from '@/lib/validations/inventory'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const counts = await prisma.cycleCount.findMany({
    include: {
      warehouse: { select: { id: true, name: true } },
      lineItems: { include: { item: { select: { id: true, name: true, packing: true, sku: true, uom: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ success: true, data: counts })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const parsed = cycleCountSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { warehouseId, countDate, notes, lineItems } = parsed.data
  const count = await prisma.cycleCount.count()
  const countNumber = `CC-${String(count + 1).padStart(5, '0')}`

  try {
    const cycleCount = await prisma.cycleCount.create({
      data: {
        countNumber,
        warehouseId,
        countDate: new Date(countDate),
        notes,
        lineItems: {
          create: lineItems.map((l) => {
            const variance = l.countedQty != null ? Number(l.countedQty) - Number(l.systemQty) : null
            return { itemId: l.itemId, systemQty: l.systemQty, countedQty: l.countedQty ?? null, variance, notes: l.notes }
          }),
        },
      },
      include: {
        warehouse: true,
        lineItems: { include: { item: true } },
      },
    })
    return NextResponse.json({ success: true, data: cycleCount }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
