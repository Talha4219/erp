import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'

const schema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1),
  type: z.enum(['NET_DAYS', 'END_OF_MONTH', 'CASH_ON_DELIVERY', 'PREPAID', 'INSTALLMENT']).default('NET_DAYS'),
  netDays: z.number().int().min(0).default(30),
  discountDays: z.number().int().min(0).nullable().optional(),
  discountPct: z.number().min(0).max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const terms = await prisma.paymentTerm.findMany({
    orderBy: [{ type: 'asc' }, { netDays: 'asc' }],
  })
  return NextResponse.json({ success: true, data: terms })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const term = await prisma.paymentTerm.create({ data: parsed.data })
    return NextResponse.json({ success: true, data: term }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
