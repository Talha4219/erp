import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const DELETE = withAuth<{ params: { id: string } }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'expenses')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  const inUse = await prisma.expense.count({ where: { categoryId: id, deletedAt: null } })
  if (inUse > 0) {
    return NextResponse.json({ success: false, error: `Cannot delete: ${inUse} expense(s) use this category` }, { status: 400 })
  }

  try {
    await prisma.expenseCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
