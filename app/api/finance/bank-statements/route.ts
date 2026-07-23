import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'
import { withAuth } from '@/lib/api-middleware'

const lineSchema = z.object({
  transactionDate: z.string(),
  description: z.string().min(1),
  amount: z.number(),
  isCredit: z.boolean(),
  reference: z.string().optional(),
})

const schema = z.object({
  bankAccountId: z.string().min(1),
  statementDate: z.string(),
  openingBalance: z.number(),
  closingBalance: z.number(),
  lines: z.array(lineSchema).min(1),
})

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const bankAccountId = searchParams.get('bankAccountId')

  try {
    const statements = await prisma.bankStatement.findMany({
      where: bankAccountId ? { bankAccountId } : {},
      include: {
        bankAccount: { select: { accountName: true, currency: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { statementDate: 'desc' },
      take: 100,
    })
    return NextResponse.json({ success: true, data: statements })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const statement = await prisma.bankStatement.create({
      data: {
        bankAccountId: parsed.data.bankAccountId,
        statementDate: new Date(parsed.data.statementDate),
        openingBalance: parsed.data.openingBalance,
        closingBalance: parsed.data.closingBalance,
        lines: {
          create: parsed.data.lines.map((l) => ({
            transactionDate: new Date(l.transactionDate),
            description: l.description,
            amount: Math.abs(l.amount),
            isCredit: l.isCredit,
            reference: l.reference,
          })),
        },
      },
      include: { lines: true, _count: { select: { lines: true } } },
    })
    return NextResponse.json({ success: true, data: statement }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
