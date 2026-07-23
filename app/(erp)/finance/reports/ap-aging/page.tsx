'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'

type AgingRow = {
  id: string; invoiceNumber: string; vendor: string
  invoiceDate: string; dueDate: string
  totalAmount: number; paidAmount: number; outstanding: number
  daysOverdue: number; bucket: string; status: string
}
type SummaryBucket = { bucket: string; count: number; total: number }
type AgingData = { asOf: string; rows: AgingRow[]; summary: SummaryBucket[]; grandTotal: number }

const BUCKET_COLOR: Record<string, string> = {
  'Current': 'bg-green-50 text-green-700 border-green-200',
  '1-30 days': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  '31-60 days': 'bg-orange-50 text-orange-700 border-orange-200',
  '61-90 days': 'bg-red-50 text-red-700 border-red-200',
  '90+ days': 'bg-red-100 text-red-800 border-red-300',
}

export default function APAgingPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0])
  const [applied, setApplied] = useState(asOf)

  const { data, isLoading } = useQuery({
    queryKey: ['ap-aging', applied],
    queryFn: () => api.get<AgingData>('/api/finance/reports/ap-aging', { asOf: applied }).then((r) => r.data),
  })

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="AP Ageing Report" description="Outstanding vendor invoices by age" />

      <Card>
        <CardContent className="p-4 flex gap-4 items-end">
          <div className="space-y-1">
            <Label>As at date</Label>
            <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-36" />
          </div>
          <Button onClick={() => setApplied(asOf)}>Run Report</Button>
        </CardContent>
      </Card>

      {data && (
        <div className="grid grid-cols-5 gap-3">
          {data.summary.map((b) => (
            <Card key={b.bucket} className={`border ${BUCKET_COLOR[b.bucket] ?? ''}`}>
              <CardContent className="p-4">
                <p className="text-xs font-medium mb-1">{b.bucket}</p>
                <p className="text-lg font-bold">{formatCurrency(b.total)}</p>
                <p className="text-xs opacity-70">{b.count} invoice{b.count !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium">Vendor</th>
                <th className="px-4 py-3 text-right font-medium">Invoice Date</th>
                <th className="px-4 py-3 text-right font-medium">Due Date</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Paid</th>
                <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                <th className="px-4 py-3 text-center font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No outstanding vendor invoices</td></tr>
              ) : (
                (data?.rows ?? []).map((row) => (
                  <tr key={row.id} className="border-t hover:bg-muted/10">
                    <td className="px-4 py-2.5 font-mono text-xs">{row.invoiceNumber}</td>
                    <td className="px-4 py-2.5">{row.vendor}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{formatDate(row.invoiceDate)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{formatDate(row.dueDate)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.totalAmount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(row.paidAmount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatCurrency(row.outstanding)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge className={`text-xs border ${BUCKET_COLOR[row.bucket] ?? ''}`}>{row.bucket}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data && data.grandTotal > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted font-bold">
                  <td colSpan={6} className="px-4 py-3 text-right">Grand Total Outstanding</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(data.grandTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
