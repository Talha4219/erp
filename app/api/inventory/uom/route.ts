import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'
import { withAuth } from '@/lib/api-middleware'
import { withCache, apiCache } from '@/lib/api-cache'

const schema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1),
  symbol: z.string().min(1),
  category: z.string().min(1),
  isBase: z.boolean().default(false),
})

export const GET = withAuth(async () => {
  try {
    return await withCache('uom', 3600, () =>
      prisma.unitOfMeasure.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      })
    )
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const uom = await prisma.unitOfMeasure.create({ data: parsed.data })
    apiCache.invalidate('uom')
    return NextResponse.json({ success: true, data: uom }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
