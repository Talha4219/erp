import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'

const schema = z.object({
  companyId: z.string().min(1),
  code: z.string().min(1).max(10),
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  isHead: z.boolean().default(false),
})

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')

  try {
    const branches = await prisma.branch.findMany({
      where: {
        isActive: true,
        ...(companyId ? { companyId } : {}),
      },
      include: { company: { select: { name: true } } },
      orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
    })
    return NextResponse.json({ success: true, data: branches })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const branch = await prisma.branch.create({
      data: parsed.data,
      include: { company: { select: { name: true } } },
    })
    return NextResponse.json({ success: true, data: branch }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
