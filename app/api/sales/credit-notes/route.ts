import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { nextCreditNoteNumber } from '@/lib/codes'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const notes = await prisma.creditNote.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { name: true } }, return: { select: { returnNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(apiResponse(notes))
  } catch {
    return NextResponse.json(apiError('Failed to fetch credit notes'), { status: 500 })
  }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { customerId, invoiceId, issueDate, amount, reason, notes } = body
    if (!customerId || !amount) return NextResponse.json(apiError('customerId, amount required'), { status: 400 })
    const creditNoteNumber = await nextCreditNoteNumber()
    const cn = await prisma.creditNote.create({
      data: { creditNoteNumber, customerId, invoiceId, issueDate: issueDate ? new Date(issueDate) : new Date(), amount: Number(amount), reason, notes },
    })
    return NextResponse.json(apiResponse(cn), { status: 201 })
  } catch {
    return NextResponse.json(apiError('Failed to create credit note'), { status: 500 })
  }
})
