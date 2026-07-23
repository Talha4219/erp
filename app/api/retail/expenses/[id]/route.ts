import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { expenseSchema } from '@/lib/validations/retail'

export const PUT = withAuth<{ params: { id: string } }>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'expenses')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  const body = await req.json()

  if (body.togglePaid !== undefined) {
    const expense = await prisma.expense.findUnique({ where: { id } })
    if (!expense) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    const updated = await prisma.expense.update({
      where: { id },
      data: { status: expense.status === 'Paid' ? 'Unpaid' : 'Paid' },
    })
    return NextResponse.json({ success: true, data: updated })
  }

  const parsed = expenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  try {
    const { expenseDate, paymentDueDate, ...rest } = parsed.data
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...rest,
        expenseDate: new Date(expenseDate),
        paymentDueDate: paymentDueDate ? new Date(paymentDueDate) : null,
      },
    })
    return NextResponse.json({ success: true, data: expense })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth<{ params: { id: string } }>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'expenses')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  try {
    await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
