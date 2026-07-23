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

type TBRow = { id: string; code: string; name: string; type: string; totalDebit: number; totalCredit: number; balance: number }
type TBData = { rows: TBRow[]; totals: { totalDebit: number; totalCredit: number } }

const TYPE_COLOR: Record<string, string> = {
  ASSET: 'bg-blue-50 text-blue-700',
  LIABILITY: 'bg-orange-50 text-orange-700',
  EQUITY: 'bg-purple-50 text-purple-700',
  REVENUE: 'bg-green-50 text-green-700',
  EXPENSE: 'bg-red-50 text-red-700',
}

export default function TrialBalancePage() {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [to, setTo] = useState(today)
  const [applied, setApplied] = useState({ from, to })

  const { data, isLoading } = useQuery({
    queryKey: ['trial-balance', applied],
    queryFn: () =>
      api.get<TBData>('/api/finance/reports/trial-balance', { from: applied.from, to: applied.to })
        .then((r) => r.data),
  })

  const rows = data?.rows ?? []
  const totals = data?.totals ?? { totalDebit: 0, totalCredit: 0 }
  const isBalanced = Math.abs(totals.totalDebit - totals.totalCredit) < 0.02

  const grouped = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((type) => ({
    type,
    rows: rows.filter((r) => r.type === type),
    subtotalDebit: rows.filter((r) => r.type === type).reduce((s, r) => s + r.totalDebit, 0),
    subtotalCredit: rows.filter((r) => r.type === type).reduce((s, r) => s + r.totalCredit, 0),
  }))

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Trial Balance"
        description="Debit and credit totals for all accounts in a period"
        actions={
          <Badge variant={isBalanced ? 'default' : 'destructive'} className="text-sm">
            {isBalanced ? 'Balanced' : 'UNBALANCED'}
          </Badge>
        }
      />

      {/* Filters */}
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
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Account</th>
                <th className="px-4 py-3 text-right font-medium">Debit (£)</th>
                <th className="px-4 py-3 text-right font-medium">Credit (£)</th>
                <th className="px-4 py-3 text-right font-medium">Balance (£)</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => group.rows.length === 0 ? null : (
                <>
                  <tr key={`hd-${group.type}`} className="bg-muted/30">
                    <td colSpan={5} className="px-4 py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TYPE_COLOR[group.type]}`}>{group.type}</span>
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.id} className="border-t hover:bg-muted/10">
                      <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{row.code}</td>
                      <td className="px-4 py-2">{row.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.totalDebit > 0 ? formatCurrency(row.totalDebit) : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.totalCredit > 0 ? formatCurrency(row.totalCredit) : '—'}</td>
                      <td className={`px-4 py-2 text-right tabular-nums font-medium ${row.balance < 0 ? 'text-red-600' : ''}`}>
                        {formatCurrency(Math.abs(row.balance))}{row.balance < 0 ? ' Cr' : ''}
                      </td>
                    </tr>
                  ))}
                  <tr key={`st-${group.type}`} className="border-t bg-muted/20 font-medium">
                    <td colSpan={2} className="px-4 py-2 text-right text-xs text-muted-foreground">Subtotal</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(group.subtotalDebit)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(group.subtotalCredit)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(Math.abs(group.subtotalDebit - group.subtotalCredit))}</td>
                  </tr>
                </>
              ))}
              <tr className="border-t-2 bg-muted font-bold">
                <td colSpan={2} className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totals.totalDebit)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totals.totalCredit)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${!isBalanced ? 'text-red-600' : ''}`}>
                  {formatCurrency(Math.abs(totals.totalDebit - totals.totalCredit))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
