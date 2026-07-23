import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'
import { withAuth } from '@/lib/api-middleware'

type Params = { params: { id: string } }

/** Auto-match statement lines to payments/journals by amount + date proximity */
export const POST = withAuth<Params>(async (req: NextRequest, { params }) => {
  const body = await req.json()

  // Manual match: provide lineId + paymentId or journalId
  if (body.lineId) {
    const schema = z.object({
      lineId: z.string(),
      matchedPaymentId: z.string().optional(),
      matchedJournalId: z.string().optional(),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })

    try {
      const line = await prisma.bankStatementLine.update({
        where: { id: parsed.data.lineId },
        data: {
          isMatched: true,
          matchedPaymentId: parsed.data.matchedPaymentId ?? null,
          matchedJournalId: parsed.data.matchedJournalId ?? null,
        },
      })
      return NextResponse.json({ success: true, data: line })
    } catch (err) {
      return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
    }
  }

  // Auto-match: match all unmatched lines in this statement
  try {
    const statement = await prisma.bankStatement.findUnique({
      where: { id: params.id },
      include: {
        lines: { where: { isMatched: false } },
        bankAccount: { select: { id: true } },
      },
    })
    if (!statement) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    let matchedCount = 0

    for (const line of statement.lines) {
      const txDate = new Date(line.transactionDate)
      const windowStart = new Date(txDate.getTime() - 3 * 86400000) // ±3 days
      const windowEnd = new Date(txDate.getTime() + 3 * 86400000)
      const amt = Number(line.amount)

      // Try customer payment first (credit = money in = customer paying us)
      if (line.isCredit) {
        const payment = await prisma.customerPayment.findFirst({
          where: {
            amount: amt,
            paymentDate: { gte: windowStart, lte: windowEnd },
          },
        })
        if (payment) {
          await prisma.bankStatementLine.update({
            where: { id: line.id },
            data: { isMatched: true, matchedPaymentId: payment.id },
          })
          matchedCount++
          continue
        }
      }

      // Try vendor payment (debit = money out = paying supplier)
      if (!line.isCredit) {
        const vPayment = await prisma.vendorPayment.findFirst({
          where: {
            amount: amt,
            paymentDate: { gte: windowStart, lte: windowEnd },
          },
        })
        if (vPayment) {
          await prisma.bankStatementLine.update({
            where: { id: line.id },
            data: { isMatched: true, matchedPaymentId: vPayment.id },
          })
          matchedCount++
          continue
        }
      }

      // Try journal entry line by amount
      const journal = await prisma.journalEntry.findFirst({
        where: {
          date: { gte: windowStart, lte: windowEnd },
          status: 'POSTED',
          lines: {
            some: line.isCredit
              ? { creditAmount: amt }
              : { debitAmount: amt },
          },
        },
      })
      if (journal) {
        await prisma.bankStatementLine.update({
          where: { id: line.id },
          data: { isMatched: true, matchedJournalId: journal.id },
        })
        matchedCount++
      }
    }

    // Check if all lines are now matched → mark statement reconciled
    const remaining = await prisma.bankStatementLine.count({
      where: { statementId: params.id, isMatched: false },
    })
    if (remaining === 0) {
      await prisma.bankStatement.update({
        where: { id: params.id },
        data: { isReconciled: true },
      })
    }

    return NextResponse.json({ success: true, data: { matchedCount, unmatched: remaining } })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

/** Unmatch a line */
export const DELETE = withAuth<Params>(async (req: NextRequest, { params }) => {
  const { searchParams } = new URL(req.url)
  const lineId = searchParams.get('lineId')
  if (!lineId) return NextResponse.json({ success: false, error: 'lineId required' }, { status: 400 })

  try {
    const line = await prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { isMatched: false, matchedPaymentId: null, matchedJournalId: null },
    })
    // Un-reconcile the statement
    await prisma.bankStatement.update({
      where: { id: params.id },
      data: { isReconciled: false },
    })
    return NextResponse.json({ success: true, data: line })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
