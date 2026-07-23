import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { withCache, apiCache } from '@/lib/api-cache'
import { z } from 'zod/v4'

const schema = z.object({
  name: z.string().min(1),
  values: z.array(z.object({
    value: z.string().min(1),
    sortOrder: z.number().int().default(0),
  })).optional(),
})

export const GET = withAuth(async () => {
  return await withCache('attributes', 3600, () =>
    prisma.itemAttribute.findMany({
      include: { values: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    })
  )
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const attr = await prisma.itemAttribute.create({
      data: {
        name: parsed.data.name,
        values: parsed.data.values ? { create: parsed.data.values } : undefined,
      },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
    })
    apiCache.invalidate('attributes')
    return NextResponse.json({ success: true, data: attr }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
