import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

function ageBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'Current'
  if (daysOverdue <= 30) return '1-30 days'
  if (daysOverdue <= 60) return '31-60 days'
  if (daysOverdue <= 90) return '61-90 days'
  return '90+ days'
}

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const asOf = searchParams.get('asOf') ? new Date(searchParams.get('asOf')!) : new Date()

  const invoices = await prisma.vendorInvoice.findMany({
    where: {
      status: { notIn: ['PAID', 'CANCELLED'] },
      deletedAt: null,
      invoiceDate: { lte: asOf },
    },
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { dueDate: 'asc' },
  })

  const r2 = (n: number) => Math.round(n * 100) / 100

  const rows = invoices.map((inv) => {
    const outstanding = r2(Number(inv.totalAmount) - Number(inv.paidAmount))
    const daysOverdue = Math.floor((asOf.getTime() - new Date(inv.dueDate).getTime()) / 86400000)
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendor: inv.vendor.name,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      totalAmount: Number(inv.totalAmount),
      paidAmount: Number(inv.paidAmount),
      outstanding,
      daysOverdue: Math.max(0, daysOverdue),
      bucket: ageBucket(daysOverdue),
      status: inv.status,
    }
  })

  const buckets = ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days']
  const summary = buckets.map((bucket) => ({
    bucket,
    count: rows.filter((r) => r.bucket === bucket).length,
    total: r2(rows.filter((r) => r.bucket === bucket).reduce((s, r) => s + r.outstanding, 0)),
  }))

  const grandTotal = r2(rows.reduce((s, r) => s + r.outstanding, 0))

  return NextResponse.json({ success: true, data: { asOf, rows, summary, grandTotal } })
})
