import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'
import { withAuth } from '@/lib/api-middleware'

const createSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  fileUrl: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  tags: z.array(z.string()).default([]),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
})

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  const search = searchParams.get('search') ?? ''
  const category = searchParams.get('category')

  try {
    const docs = await prisma.businessDocument.findMany({
      where: {
        status: 'ACTIVE',
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(category ? { category } : {}),
        ...(search ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { fileName: { contains: search, mode: 'insensitive' } },
            { tags: { has: search } },
          ],
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ success: true, data: docs })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const doc = await prisma.businessDocument.create({
      data: {
        ...parsed.data,
        expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : undefined,
        uploadedById: session.user.id!,
      },
    })
    return NextResponse.json({ success: true, data: doc }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
