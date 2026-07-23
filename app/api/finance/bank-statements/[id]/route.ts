import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const statement = await prisma.bankStatement.findUnique({
      where: { id: params.id },
      include: {
        bankAccount: { select: { accountName: true, currency: true, bankName: true } },
        lines: { orderBy: { transactionDate: 'asc' } },
      },
    })
    if (!statement) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: statement })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
