import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { auth } from '@/lib/auth'
import { createJournalEntry, findAccount } from '@/lib/services/accounting'
import { hasModuleAccess } from '@/lib/authz'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !hasModuleAccess(session, 'procurement'))
    return NextResponse.json(apiError('Forbidden'), { status: 403 })
  try {
    const { id } = await params
    const inv = await prisma.vendorInvoice.findUnique({
      where: { id },
      include: {
        vendor: true,
        po: { include: { lineItems: true, grns: { include: { lineItems: true } } } },
        department: { select: { id: true, name: true } },
        costCentre: { select: { id: true, name: true } },
        items: {
          include: {
            item: { select: { name: true, sku: true } },
            glAccount: { select: { code: true, name: true } },
            warehouse: { select: { name: true } },
            costCentre: { select: { name: true } },
            project: { select: { name: true } },
          },
        },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    })
    if (!inv) return NextResponse.json(apiError('Not found'), { status: 404 })

    const [ratingAgg, outstandingAgg, journalEntries] = await Promise.all([
      prisma.supplierRating.aggregate({ where: { vendorId: inv.vendorId }, _avg: { overallScore: true } }),
      prisma.vendorInvoice.aggregate({
        where: { vendorId: inv.vendorId, deletedAt: null, status: { notIn: ['PAID', 'CANCELLED'] } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.journalEntry.findMany({
        where: {
          deletedAt: null,
          reference: { in: [`VINV:${id}`, ...inv.payments.map((p) => `VPAY:${p.id}`)] },
        },
        include: {
          lines: {
            include: {
              debitAccount: { select: { code: true, name: true } },
              creditAccount: { select: { code: true, name: true } },
              costCentre: { select: { name: true } },
            },
          },
        },
        orderBy: { date: 'asc' },
      }),
    ])

    const vendorOutstanding = Number(outstandingAgg._sum.totalAmount ?? 0) - Number(outstandingAgg._sum.paidAmount ?? 0)

    return NextResponse.json(apiResponse({
      ...inv,
      vendorRating: ratingAgg._avg.overallScore,
      vendorOutstandingBalance: vendorOutstanding,
      journalEntries,
    }))
  } catch (e) {
    console.error('[procurement/vendor-invoices/:id GET]', (e as Error).message)
    return NextResponse.json(apiError('Failed'), { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !hasModuleAccess(session, 'procurement'))
    return NextResponse.json(apiError('Forbidden'), { status: 403 })
  try {
    const { id } = await params
    const body = await req.json()
    const updated = await prisma.vendorInvoice.update({ where: { id }, data: body })

    // Post the Accounts Payable liability the first time an invoice is verified/sent for payment
    if (body.status === 'SENT' && session?.user?.id) {
      const existing = await prisma.journalEntry.findFirst({ where: { reference: `VINV:${id}` } })
      if (!existing) {
        await prisma.$transaction(async (tx) => {
          const [expenseAcc, apAcc] = await Promise.all([
            findAccount(tx, '1130'),
            findAccount(tx, '2000'),
          ])
          if (!expenseAcc || !apAcc) return
          await createJournalEntry(tx, {
            description: `Supplier invoice ${updated.invoiceNumber} — AP liability`,
            date: new Date(),
            reference: `VINV:${id}`,
            createdById: session.user.id!,
            lines: [
              { debitAccountId: expenseAcc.id, debitAmount: Number(updated.totalAmount), description: 'Goods/services received' },
              { creditAccountId: apAcc.id, creditAmount: Number(updated.totalAmount), description: 'Accounts payable booked' },
            ],
          })
        })
      }
    }

    return NextResponse.json(apiResponse(updated))
  } catch (e) {
    console.error('[procurement/vendor-invoices/:id PATCH]', (e as Error).message)
    return NextResponse.json(apiError('Failed'), { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !hasModuleAccess(session, 'procurement'))
    return NextResponse.json(apiError('Forbidden'), { status: 403 })
  try {
    const { id } = await params
    await prisma.vendorInvoice.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json(apiResponse(null))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
}
