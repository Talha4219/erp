import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'
import { withAuth } from '@/lib/api-middleware'

const createSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  sellingPrice: z.number().nullable().optional(),
  standardCost: z.number().nullable().optional(),
  isActive: z.boolean().default(true),
  attributeValueIds: z.array(z.string()).min(1),
})

const variantInclude = {
  attributes: {
    include: { attributeValue: { include: { attribute: true } } },
  },
}

export const GET = withAuth(async (_req: NextRequest, { params }: { params: Promise<{ id: string }>; session: import('@/lib/api-middleware').AuthedSession }) => {
  const { id } = await params
  const variants = await prisma.itemVariant.findMany({
    where: { itemId: id },
    include: variantInclude,
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ success: true, data: variants })
})

export const POST = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }>; session: import('@/lib/api-middleware').AuthedSession }) => {
  const { id } = await params
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { attributeValueIds, ...data } = parsed.data
  try {
    const variant = await prisma.itemVariant.create({
      data: {
        ...data,
        itemId: id,
        attributes: { create: attributeValueIds.map((avId) => ({ attributeValueId: avId })) },
      },
      include: variantInclude,
    })
    return NextResponse.json({ success: true, data: variant }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
