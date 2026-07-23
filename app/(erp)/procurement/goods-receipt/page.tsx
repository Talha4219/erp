'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Package, Truck, CheckCircle, XCircle, Clock, TrendingUp,
  Eye, Plus, X, BarChart3, Warehouse,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type GRN = {
  id: string; grnNumber: string; receivedDate: string
  receivedById: string; notes: string | null
  po: { poNumber: string; vendor: { name: string } }
  _count: { lineItems: number }
}

// ── Analytics types ───────────────────────────────────────────────────────────

type Analytics = {
  kpis: { todayCount: number; totalItemsReceived: number; pendingGRNs: number; rejectedItems: number; receivingValue: number }
  dailyTrend: Array<{ day: string; date: string; value: number }>
  statusDist: Array<{ label: string; count: number; cls: string }>
  supplierQuality: Array<{ name: string; accepted: number; rejected: number }>
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GoodsReceiptPage() {
  const [search, setSearch]     = useState('')
  const [filterFrom, setFrom]   = useState('')
  const [filterTo, setTo]       = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['grns'],
    queryFn: () => api.get<GRN[]>('/api/procurement/grns').then(r => r.data ?? []),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['grns-analytics'],
    queryFn: () => api.get<Analytics>('/api/procurement/grns/analytics').then(r => r.data!),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const grns = useMemo(() => data ?? [], [data])

  // ── Analytics derived ──────────────────────────────────────────────────────
  const dailyTrend = analytics?.dailyTrend ?? []
  const statusDist = analytics?.statusDist ?? []
  const qualityData = analytics?.supplierQuality ?? []
  const maxTrend  = Math.max(...dailyTrend.map(d => d.value), 1)
  const totalDist = statusDist.reduce((s, d) => s + d.count, 0)

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => grns.filter(g => {
    if (search) {
      const q = search.toLowerCase()
      if (!g.grnNumber.toLowerCase().includes(q) && !g.po.vendor.name.toLowerCase().includes(q) && !g.po.poNumber.toLowerCase().includes(q)) return false
    }
    if (filterFrom && new Date(g.receivedDate) < new Date(filterFrom)) return false
    if (filterTo   && new Date(g.receivedDate) > new Date(filterTo)) return false
    return true
  }), [grns, search, filterFrom, filterTo])

  const hasFilters = search || filterFrom || filterTo

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow-sm">
            <Warehouse className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Goods Receipt</h1>
            <p className="text-xs text-muted-foreground">Receiving control · stock update · supplier quality tracking</p>
          </div>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs gap-1.5" asChild>
          <Link href="/procurement/goods-receipt/new"><Plus className="h-3.5 w-3.5" />New GRN</Link>
        </Button>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { Icon: Package,     label: "Today's Receipts", value: analytics?.kpis.todayCount ?? '—',                                      cls: 'text-blue-600',    bg: 'bg-blue-50' },
          { Icon: CheckCircle, label: 'Items Received',   value: (analytics?.kpis.totalItemsReceived ?? 0).toLocaleString(),              cls: 'text-emerald-600', bg: 'bg-emerald-50' },
          { Icon: Clock,       label: 'Pending GRNs',     value: analytics?.kpis.pendingGRNs ?? '—',                                     cls: 'text-amber-600',   bg: 'bg-amber-50' },
          { Icon: XCircle,     label: 'Rejected Items',   value: analytics?.kpis.rejectedItems ?? '—',                                   cls: 'text-red-600',     bg: 'bg-red-50' },
          { Icon: Truck,       label: 'Total GRNs',       value: grns.length,                                                            cls: 'text-purple-600',  bg: 'bg-purple-50' },
          { Icon: TrendingUp,  label: 'Receiving Value',  value: analytics ? formatCurrency(analytics.kpis.receivingValue) : '—',        cls: 'text-slate-700',   bg: 'bg-slate-50' },
        ].map(({ Icon, label, value, cls, bg }) => (
          <Card key={label} className="border-border/60 shadow-sm">
            <CardContent className="p-3.5">
              <div className={cn('mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg', bg)}>
                <Icon className={cn('h-3.5 w-3.5', cls)} />
              </div>
              <p className={cn('text-lg font-bold leading-tight', cls)}>{value}</p>
              <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Analytics row ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Daily receiving trend */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" />Daily Receiving Trend (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {analyticsLoading ? (
              <div className="h-28 animate-pulse rounded-lg bg-muted" />
            ) : dailyTrend.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No receipt data yet.</p>
            ) : (
              <div className="flex items-end gap-2 h-28">
                {dailyTrend.map(d => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-semibold text-muted-foreground">{Math.round(d.value / 1000)}k</span>
                    <div className="w-full rounded-t-md bg-emerald-500/20 flex items-end" style={{ height: '80px' }}>
                      <div className="w-full rounded-t-md bg-emerald-500 transition-all"
                        style={{ height: `${Math.max(4, Math.round((d.value / maxTrend) * 100))}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 font-medium">{d.day}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt status distribution */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />Receipt Status
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {analyticsLoading ? (
              <div className="h-20 animate-pulse rounded-lg bg-muted" />
            ) : (
              <>
                {statusDist.map(s => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{s.label}</span>
                      <span className="text-xs font-bold text-muted-foreground">{s.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full', s.cls)}
                        style={{ width: totalDist > 0 ? `${Math.round(s.count / totalDist * 100)}%` : '0%' }} />
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground/50 text-right pt-1">{totalDist} total POs tracked</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Supplier quality ── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />Supplier Quality Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          {analyticsLoading ? (
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          ) : qualityData.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No quality data yet.</p>
          ) : (
            <>
              {qualityData.map(q => {
                const total  = q.accepted + q.rejected
                const accPct = Math.round(q.accepted / total * 100)
                const rejPct = 100 - accPct
                return (
                  <div key={q.name} className="flex items-center gap-4">
                    <div className="w-28 shrink-0 text-xs font-medium truncate">{q.name}</div>
                    <div className="flex-1 h-5 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500 flex items-center justify-center" style={{ width: `${accPct}%` }}>
                        <span className="text-[9px] font-bold text-white">{q.accepted}</span>
                      </div>
                      {rejPct > 0 && (
                        <div className="h-full bg-red-400 flex items-center justify-center" style={{ width: `${rejPct}%` }}>
                          <span className="text-[9px] font-bold text-white">{q.rejected}</span>
                        </div>
                      )}
                    </div>
                    <div className="w-14 shrink-0 text-right">
                      <span className={cn('text-xs font-bold', accPct >= 95 ? 'text-emerald-600' : accPct >= 90 ? 'text-amber-600' : 'text-red-500')}>{accPct}%</span>
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />Accepted</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" />Rejected</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search GRN#, supplier or PO…" value={search} onChange={e => setSearch(e.target.value)}
          className="h-8 w-60 text-xs" />
        <Input type="date" value={filterFrom} onChange={e => setFrom(e.target.value)} className="h-8 w-36 text-xs" />
        <span className="text-xs text-muted-foreground">–</span>
        <Input type="date" value={filterTo} onChange={e => setTo(e.target.value)} className="h-8 w-36 text-xs" />
        {hasFilters && (
          <Button variant="outline" size="sm" className="h-8 text-xs"
            onClick={() => { setSearch(''); setFrom(''); setTo('') }}>
            <X className="h-3.5 w-3.5 mr-1" />Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground/60">{filtered.length} GRN{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── GRN Table ── */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Warehouse className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No goods receipts found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Adjust filters or create a new GRN from an approved PO</p>
              <Button size="sm" className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-xs" asChild>
                <Link href="/procurement/goods-receipt/new"><Plus className="mr-1.5 h-3.5 w-3.5" />New GRN</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    {['GRN Number', 'PO Number', 'Supplier', 'Receipt Date', 'Line Items', 'Received By', ''].map((h, i) => (
                      <th key={h} className={cn('px-4 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground/60',
                        i === 0 ? 'text-left' : i >= 4 ? 'text-center' : 'text-left')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map(g => (
                    <tr key={g.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-2.5">
                        <Link href={`/procurement/goods-receipt/${g.id}`}
                          className="font-mono font-semibold text-emerald-600 hover:text-emerald-800">
                          {g.grnNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-blue-600">{g.po.poNumber}</span>
                      </td>
                      <td className="px-4 py-2.5 font-medium">{g.po.vendor.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(g.receivedDate)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold">{g._count.lineItems}</span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{g.receivedById}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/procurement/goods-receipt/${g.id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-muted p-1.5 text-muted-foreground hover:bg-muted/80 inline-flex">
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
