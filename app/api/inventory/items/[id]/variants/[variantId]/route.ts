import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'
import { withAuth } from '@/lib/api-middleware'

const patchSchema = z.object({
  barcode: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  sellingPrice: z.number().nullable().optional(),
  standardCost: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
})

type Params = Promise<{ id: string; variantId: string }>

export const PATCH = withAuth(async (req: NextRequest, { params }: { params: Params; session: import('@/lib/api-middleware').AuthedSession }) => {
  const { id, variantId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const variant = await prisma.itemVariant.update({
      where: { id: variantId, itemId: id },
      data: parsed.data,
      include: {
        attributes: { include: { attributeValue: { include: { attribute: true } } } },
      },
    })
    return NextResponse.json({ success: true, data: variant })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: NextRequest, { params }: { params: Params; session: import('@/lib/api-middleware').AuthedSession }) => {
  const { id, variantId } = await params
  try {
    await prisma.itemVariant.delete({ where: { id: variantId, itemId: id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
