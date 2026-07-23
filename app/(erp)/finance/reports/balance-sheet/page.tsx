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
import { formatCurrency } from '@/lib/utils'

type AccRow = { id: string; code: string; name: string; balance: number }
type BSData = {
  asOf: string
  assetAccounts: AccRow[]; liabilityAccounts: AccRow[]; equityAccounts: AccRow[]
  retainedEarnings: number
  totalAssets: number; totalLiabilities: number; totalEquity: number
  isBalanced: boolean
}

function Section({ title, rows, total, color }: { title: string; rows: AccRow[]; total: number; color: string }) {
  return (
    <>
      <div className={`px-6 py-3 font-semibold border-b ${color}`}>{title}</div>
      {rows.map((acc) => (
        <div key={acc.id} className="flex justify-between px-8 py-2.5 border-b text-sm hover:bg-muted/20">
          <span className="text-muted-foreground">{acc.code} — {acc.name}</span>
          <span className="tabular-nums font-medium">{formatCurrency(acc.balance)}</span>
        </div>
      ))}
      <div className={`flex justify-between px-6 py-3 font-semibold border-b ${color}/70`}>
        <span>Total {title}</span>
        <span className="tabular-nums">{formatCurrency(total)}</span>
      </div>
    </>
  )
}

export default function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0])
  const [applied, setApplied] = useState(asOf)

  const { data, isLoading } = useQuery({
    queryKey: ['balance-sheet', applied],
    queryFn: () => api.get<BSData>('/api/finance/reports/balance-sheet', { asOf: applied }).then((r) => r.data),
  })

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Balance Sheet"
        description="Assets, liabilities and equity at a point in time"
        actions={data && <Badge variant={data.isBalanced ? 'default' : 'destructive'}>{data.isBalanced ? 'Balanced' : 'UNBALANCED'}</Badge>}
      />

      <Card>
        <CardContent className="p-4 flex gap-4 items-end">
          <div className="space-y-1">
            <Label>As at date</Label>
            <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-36" />
          </div>
          <Button onClick={() => setApplied(asOf)}>Run Report</Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="rounded-lg border overflow-hidden">
            <Section title="Assets" rows={data?.assetAccounts ?? []} total={data?.totalAssets ?? 0} color="bg-blue-50/50 text-blue-800" />
          </div>

          {/* Liabilities + Equity */}
          <div className="rounded-lg border overflow-hidden">
            <Section title="Liabilities" rows={data?.liabilityAccounts ?? []} total={data?.totalLiabilities ?? 0} color="bg-orange-50/50 text-orange-800" />
            <Section title="Equity" rows={[...(data?.equityAccounts ?? []), ...(data?.retainedEarnings ? [{ id: 'ret', code: '—', name: 'Retained Earnings', balance: data.retainedEarnings }] : [])]} total={data?.totalEquity ?? 0} color="bg-purple-50/50 text-purple-800" />
            <div className="flex justify-between px-6 py-4 font-bold bg-muted border-t-2">
              <span>Total Liabilities + Equity</span>
              <span className="tabular-nums">{formatCurrency((data?.totalLiabilities ?? 0) + (data?.totalEquity ?? 0))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
