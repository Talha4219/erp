import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'
import { hasModuleAccess } from '@/lib/authz'

const patchSchema = z.object({
  action: z.enum(['add_value', 'delete_value', 'rename']),
  value: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  valueId: z.string().optional(),
  name: z.string().min(1).optional(),
})

export const PATCH = withAuth(async (req: NextRequest, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const { action, value, sortOrder, valueId, name } = parsed.data

    if (action === 'rename' && name) {
      await prisma.itemAttribute.update({ where: { id }, data: { name } })
    } else if (action === 'add_value' && value) {
      await prisma.itemAttributeValue.create({
        data: { attributeId: id, value, sortOrder: sortOrder ?? 0 },
      })
    } else if (action === 'delete_value' && valueId) {
      await prisma.itemAttributeValue.delete({ where: { id: valueId } })
    }

    const attr = await prisma.itemAttribute.findUnique({
      where: { id },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
    })
    return NextResponse.json({ success: true, data: attr })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: NextRequest, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  try {
    await prisma.itemAttribute.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
