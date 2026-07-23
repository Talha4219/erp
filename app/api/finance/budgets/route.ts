import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const budgets = await prisma.budget.findMany({
    where: { ...(year && { fiscalYear: parseInt(year) }) },
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
      costCentre: { select: { id: true, code: true, name: true } },
      lines: { orderBy: { month: 'asc' } },
    },
    orderBy: [{ fiscalYear: 'desc' }, { account: { code: 'asc' } }],
  })
  return NextResponse.json({ success: true, data: budgets })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { lines = [], ...rest } = await req.json()
    const budget = await prisma.budget.create({
      data: { ...rest, lines: { create: lines } },
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
        costCentre: { select: { id: true, code: true, name: true } },
        lines: { orderBy: { month: 'asc' } },
      },
    })
    return NextResponse.json({ success: true, data: budget }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})
