import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withCache, apiCache } from '@/lib/api-cache'
import { warehouseSchema } from '@/lib/validations/inventory'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  return await withCache('warehouses', 300, () =>
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, take: 100 })
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const parsed = warehouseSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  try {
    const warehouse = await prisma.warehouse.create({ data: parsed.data })
    apiCache.invalidate('warehouses')
    return NextResponse.json({ success: true, data: warehouse }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
