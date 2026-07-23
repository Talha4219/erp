import type { Prisma } from '@prisma/client'

type JournalLine = {
  debitAccountId?: string | null
  creditAccountId?: string | null
  debitAmount?: number
  creditAmount?: number
  description?: string
  currencyCode?: string
  costCentreId?: string | null
}

export async function createJournalEntry(
  tx: Prisma.TransactionClient,
  opts: {
    description: string
    date: Date
    reference?: string
    createdById: string
    lines: JournalLine[]
  }
) {
  const count = await tx.journalEntry.count()
  const entryNumber = `JE-${String(count + 1).padStart(6, '0')}`

  return tx.journalEntry.create({
    data: {
      entryNumber,
      date: opts.date,
      description: opts.description,
      reference: opts.reference,
      status: 'POSTED',
      postedAt: new Date(),
      createdById: opts.createdById,
      lines: {
        create: opts.lines.map((l) => ({
          debitAccountId: l.debitAccountId ?? null,
          creditAccountId: l.creditAccountId ?? null,
          debitAmount: l.debitAmount ?? 0,
          creditAmount: l.creditAmount ?? 0,
          description: l.description,
          currencyCode: l.currencyCode ?? 'GBP',
          costCentreId: l.costCentreId ?? null,
        })),
      },
    },
  })
}

/** Find account by code or return null */
export async function findAccount(tx: Prisma.TransactionClient, code: string) {
  return tx.account.findFirst({ where: { code, isActive: true } })
}
