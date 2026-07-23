import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { withCache, apiCache } from '@/lib/api-cache'

export const GET = withAuth(async () => {
  return await withCache('categories', 3600, () =>
    prisma.itemCategory.findMany({ orderBy: { name: 'asc' }, take: 100 })
  )
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const category = await prisma.itemCategory.create({ data: body })
    apiCache.invalidate('categories')
    return NextResponse.json({ success: true, data: category }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
