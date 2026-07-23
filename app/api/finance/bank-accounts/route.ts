import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { apiErrorSafe } from '@/lib/utils'
import { getUserCompanyId } from '@/lib/company-scope'
import { z } from 'zod'
import { withAuth } from '@/lib/api-middleware'

const schema = z.object({
  accountName: z.string().min(2),
  accountNumber: z.string().min(4),
  sortCode: z.string().optional(),
  iban: z.string().optional(),
  bankName: z.string().min(2),
  currency: z.string().default('GBP'),
  accountType: z.enum(['CURRENT','SAVINGS','CREDIT_CARD','LOAN']).default('CURRENT'),
  glAccountCode: z.string().optional(),
  openingBalance: z.number().default(0),
})

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id)

  const accounts = await prisma.bankAccount.findMany({
    where: { isActive: true, ...(companyId ? { companyId } : {}) },
    include: {
      _count: { select: { statements: true, transactions: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })
  return NextResponse.json({ success: true, data: accounts })
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json(apiErrorSafe(parsed.error, 'Validation failed'), { status: 400 })

  const { openingBalance, ...rest } = parsed.data
  const account = await prisma.bankAccount.create({
    data: { ...rest, openingBalance, currentBalance: openingBalance },
  })
  return NextResponse.json({ success: true, data: account }, { status: 201 })
})
