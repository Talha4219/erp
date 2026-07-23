import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const PUT = withAuth<{ params: Promise<{ id: string }> }>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { lines, ...rest } = await req.json()
    const budget = await prisma.$transaction(async (tx) => {
      await tx.budgetLine.deleteMany({ where: { budgetId: (await params).id } })
      return tx.budget.update({
        where: { id: (await params).id },
        data: { ...rest, lines: { create: lines ?? [] } },
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
          costCentre: { select: { id: true, code: true, name: true } },
          lines: { orderBy: { month: 'asc' } },
        },
      })
    })
    return NextResponse.json({ success: true, data: budget })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})

export const DELETE = withAuth<{ params: Promise<{ id: string }> }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    await prisma.budget.delete({ where: { id: (await params).id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})
