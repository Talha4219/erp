'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

type Account = { id: string; code: string; name: string; net: number }
type PnLData = {
  from: string; to: string
  revenueAccounts: Account[]; expenseAccounts: Account[]
  totalRevenue: number; totalExpenses: number; netProfit: number
}

export default function PnLPage() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [applied, setApplied] = useState({ from, to })

  const { data, isLoading } = useQuery({
    queryKey: ['pnl', applied],
    queryFn: () => api.get<PnLData>('/api/finance/reports/pnl', { from: applied.from, to: applied.to }).then((r) => r.data),
  })

  const profit = data?.netProfit ?? 0

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Profit & Loss Statement" description="Income and expenditure for the selected period" />

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
          </div>
          <Button onClick={() => setApplied({ from, to })}>Run Report</Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : (
        <div className="max-w-2xl space-y-0 rounded-lg border overflow-hidden">
          {/* Revenue */}
          <div className="bg-green-50/50 px-6 py-3 font-semibold text-green-800 border-b">Revenue</div>
          {(data?.revenueAccounts ?? []).map((acc) => (
            <div key={acc.id} className="flex justify-between px-8 py-2.5 border-b text-sm hover:bg-muted/20">
              <span className="text-muted-foreground">{acc.code} — {acc.name}</span>
              <span className="tabular-nums font-medium">{formatCurrency(acc.net)}</span>
            </div>
          ))}
          <div className="flex justify-between px-6 py-3 font-semibold bg-green-50/70 border-b">
            <span>Total Revenue</span>
            <span className="tabular-nums text-green-700">{formatCurrency(data?.totalRevenue ?? 0)}</span>
          </div>

          {/* Expenses */}
          <div className="bg-red-50/50 px-6 py-3 font-semibold text-red-800 border-b">Expenses</div>
          {(data?.expenseAccounts ?? []).map((acc) => (
            <div key={acc.id} className="flex justify-between px-8 py-2.5 border-b text-sm hover:bg-muted/20">
              <span className="text-muted-foreground">{acc.code} — {acc.name}</span>
              <span className="tabular-nums font-medium">{formatCurrency(acc.net)}</span>
            </div>
          ))}
          <div className="flex justify-between px-6 py-3 font-semibold bg-red-50/70 border-b">
            <span>Total Expenses</span>
            <span className="tabular-nums text-red-700">{formatCurrency(data?.totalExpenses ?? 0)}</span>
          </div>

          {/* Net */}
          <div className={`flex justify-between px-6 py-4 font-bold text-lg ${profit >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            <span>{profit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
            <span className="tabular-nums">{formatCurrency(Math.abs(profit))}</span>
          </div>
        </div>
      )}
    </div>
  )
}
