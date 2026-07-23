import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { journalEntrySchema } from '@/lib/validations/finance'
import { nextDocNumber } from '@/lib/services/numbering'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  try {
    const entries = await prisma.journalEntry.findMany({
      include: { lines: true, createdBy: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 100,
    })
    return NextResponse.json({ success: true, data: entries })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = journalEntrySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { date, description, reference, lines } = parsed.data

  const totalDebit = lines.reduce((s, l) => s + (l.debitAmount ?? 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.creditAmount ?? 0), 0)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return NextResponse.json({ success: false, error: 'Journal entry is not balanced (debit must equal credit)' }, { status: 400 })
  }

  try {
    const entryNumber = await nextDocNumber('journal_entry')

    const entry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(date),
        description,
        reference,
        createdById: session.user.id,
        lines: { create: lines },
      },
      include: { lines: true },
    })
    return NextResponse.json({ success: true, data: entry }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
