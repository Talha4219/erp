import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { expenseSchema, expenseCategorySchema } from '@/lib/validations/retail'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('categoryId')
  const supplierId = searchParams.get('supplierId')
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const categoriesOnly = searchParams.get('categories') === 'true'

  if (categoriesOnly) {
    const cats = await prisma.expenseCategory.findMany({ orderBy: { categoryName: 'asc' } })
    return NextResponse.json({ success: true, data: cats })
  }

  try {
    const expenses = await prisma.expense.findMany({
      where: {
        deletedAt: null,
        ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
        ...(supplierId ? { supplierId: parseInt(supplierId) } : {}),
        ...(status ? { status } : {}),
        ...(from || to
          ? {
              expenseDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to + 'T23:59:59Z') } : {}),
              },
            }
          : {}),
      },
       include: { category: true, vendor: true },
      orderBy: { expenseDate: 'desc' },
    })
    return NextResponse.json({ success: true, data: expenses })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()

  if (body.categoryName) {
    const parsed = expenseCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const cat = await prisma.expenseCategory.create({ data: parsed.data })
    return NextResponse.json({ success: true, data: cat }, { status: 201 })
  }

  const parsed = expenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const { expenseDate, paymentDueDate, ...rest } = parsed.data
    const expense = await prisma.expense.create({
      data: {
        ...rest,
        expenseDate: new Date(expenseDate),
        paymentDueDate: paymentDueDate ? new Date(paymentDueDate) : null,
      },
      include: { category: true },
    })
    return NextResponse.json({ success: true, data: expense }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
