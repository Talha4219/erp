import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'

const schema = z.object({
  module: z.string().min(1),
  prefix: z.string().min(1),
  suffix: z.string().optional(),
  nextNumber: z.number().int().min(1).optional(),
  padding: z.number().int().min(1).max(10).optional(),
  resetAnnually: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  companyId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const module_ = searchParams.get('module')

  try {
    const series = await prisma.numberingSeries.findMany({
      where: module_ ? { module: module_ } : {},
      orderBy: [{ module: 'asc' }, { isDefault: 'desc' }],
      include: { company: { select: { name: true } } },
    })
    return NextResponse.json({ success: true, data: series })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const series = await prisma.numberingSeries.create({ data: parsed.data })
    return NextResponse.json({ success: true, data: series }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
