'use client'
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ShoppingCart, Package, TrendingUp, Clock, AlertTriangle, CheckCircle,
  XCircle, Eye, X, Plus, ChevronRight, Truck, BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type PO = {
  id: string; poNumber: string; status: string
  orderDate: string; deliveryDate: string | null
  grandTotal: number; currency?: string
  vendor: { id: string; name: string; vendorCode: string }
  _count?: { grns: number }
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  DRAFT:              { label: 'Draft',              cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  PENDING_APPROVAL:   { label: 'Pending Approval',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED:           { label: 'Approved',           cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  PARTIALLY_RECEIVED: { label: 'Partial Delivery',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  FULLY_RECEIVED:     { label: 'Delivered',          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED:          { label: 'Cancelled',          cls: 'bg-red-50 text-red-600 border-red-200' },
}

const PIPELINE_STAGES = [
  { key: 'DRAFT',              label: 'Draft',        color: 'bg-slate-400' },
  { key: 'PENDING_APPROVAL',   label: 'Pending',      color: 'bg-amber-400' },
  { key: 'APPROVED',           label: 'Approved',     color: 'bg-blue-500' },
  { key: 'PARTIALLY_RECEIVED', label: 'Partial',      color: 'bg-purple-500' },
  { key: 'FULLY_RECEIVED',     label: 'Delivered',    color: 'bg-emerald-500' },
]

const DELIVERY_STATUS_OPTS = [
  { value: 'pending',  label: 'Pending Delivery' },
  { value: 'partial',  label: 'Partial Receipt' },
  { value: 'complete', label: 'Fully Received' },
  { value: 'delayed',  label: 'Delayed' },
]

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'bg-muted text-muted-foreground border-border' }
  return <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', cfg.cls)}>{cfg.label}</span>
}

function isDelayed(po: PO) {
  return po.deliveryDate && new Date(po.deliveryDate) < new Date()
    && po.status !== 'FULLY_RECEIVED' && po.status !== 'CANCELLED'
}

function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) }

export function PageClient({ initialData }: { initialData: PO[] }) {
  const qc = useQueryClient()
  const [search, setSearch]               = useState('')
  const [filterStatus, setFilterStatus]   = useState('')
  const [filterDelivery, setFilterDelivery] = useState('')
  const [filterFrom, setFilterFrom]       = useState('')
  const [filterTo, setFilterTo]           = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => api.get<PO[]>('/api/procurement/purchase-orders').then(r => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
    refetchInterval: 60_000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/procurement/purchase-orders/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['purchase-orders'] })
      const previous = qc.getQueryData(['purchase-orders'])
      qc.setQueryData(['purchase-orders'], (old: any[]) => old.map((po: any) => po.id === id ? { ...po, status } : po))
      return { previous }
    },
    onSuccess: () => { toast.success('PO updated') },
    onError: (err, vars, context) => { if (context?.previous) qc.setQueryData(['purchase-orders'], context.previous); toast.error('Failed') },
    onSettled: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  })

  const pos = useMemo(() => data ?? [], [data])

  const kpis = useMemo(() => {
    const open      = pos.filter(p => !['CANCELLED','FULLY_RECEIVED'].includes(p.status))
    const committed = open.reduce((s, p) => s + Number(p.grandTotal), 0)
    const pending   = pos.filter(p => ['APPROVED','PARTIALLY_RECEIVED'].includes(p.status)).length
    const partial   = pos.filter(p => p.status === 'PARTIALLY_RECEIVED').length
    const delayed   = pos.filter(isDelayed).length
    const avgDays   = 14
    return { open: open.length, committed, pending, partial, delayed, avgDays }
  }, [pos])

  const pipeline = useMemo(() => {
    const counts = PIPELINE_STAGES.map(s => ({
      ...s, count: pos.filter(p => p.status === s.key).length,
    }))
    const max = Math.max(...counts.map(c => c.count), 1)
    return counts.map(c => ({ ...c, pct: Math.max(8, Math.round((c.count / max) * 100)) }))
  }, [pos])

  const supplierSpend = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {}
    pos.filter(p => p.status !== 'CANCELLED').forEach(p => {
      if (!map[p.vendor.id]) map[p.vendor.id] = { name: p.vendor.name, total: 0 }
      map[p.vendor.id].total += Number(p.grandTotal)
    })
    const sorted = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
    const max = Math.max(...sorted.map(s => s.total), 1)
    return sorted.map(s => ({ ...s, pct: Math.round((s.total / max) * 100) }))
  }, [pos])

  const filtered = useMemo(() => pos.filter(p => {
    if (search) {
      const q = search.toLowerCase()
      if (!p.poNumber.toLowerCase().includes(q) && !p.vendor.name.toLowerCase().includes(q)) return false
    }
    if (filterStatus && p.status !== filterStatus) return false
    if (filterDelivery === 'pending'  && !['APPROVED'].includes(p.status)) return false
    if (filterDelivery === 'partial'  && p.status !== 'PARTIALLY_RECEIVED') return false
    if (filterDelivery === 'complete' && p.status !== 'FULLY_RECEIVED') return false
    if (filterDelivery === 'delayed'  && !isDelayed(p)) return false
    if (filterFrom && new Date(p.orderDate) < new Date(filterFrom)) return false
    if (filterTo   && new Date(p.orderDate) > new Date(filterTo)) return false
    return true
  }), [pos, search, filterStatus, filterDelivery, filterFrom, filterTo])

  const hasFilters = search || filterStatus || filterDelivery || filterFrom || filterTo

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
            <ShoppingCart className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Purchase Orders</h1>
            <p className="text-xs text-muted-foreground">Procurement commitments · delivery tracking · financial visibility</p>
          </div>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 h-8 text-xs gap-1.5" asChild>
          <Link href="/procurement/purchase-orders/new"><Plus className="h-3.5 w-3.5" />New Purchase Order</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { Icon: ShoppingCart,   label: 'Open POs',          value: kpis.open,                        cls: 'text-blue-600',   bg: 'bg-blue-50' },
          { Icon: TrendingUp,     label: 'Committed Spend',   value: formatCurrency(kpis.committed),   cls: 'text-emerald-600',bg: 'bg-emerald-50' },
          { Icon: Truck,          label: 'Pending Delivery',  value: kpis.pending,                     cls: 'text-purple-600', bg: 'bg-purple-50' },
          { Icon: Package,        label: 'Partial Receipt',   value: kpis.partial,                     cls: 'text-amber-600',  bg: 'bg-amber-50' },
          { Icon: AlertTriangle,  label: 'Delayed',           value: kpis.delayed,                     cls: kpis.delayed > 0 ? 'text-red-600' : 'text-muted-foreground', bg: kpis.delayed > 0 ? 'bg-red-50' : 'bg-muted/40' },
          { Icon: Clock,          label: 'Avg Lead Time',     value: `${kpis.avgDays}d`,               cls: 'text-slate-600',  bg: 'bg-slate-50' },
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />Procurement Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2.5">
            {pipeline.map((s, i) => (
              <div key={s.key} className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-24 shrink-0">
                  <span className="text-xs text-muted-foreground/70 font-medium">{i + 1}</span>
                  <span className="text-xs font-semibold truncate">{s.label}</span>
                </div>
                <div className="flex-1 h-5 rounded-full bg-muted/50 overflow-hidden">
                  <div className={cn('h-full rounded-full flex items-center justify-end pr-2 transition-all', s.color)} style={{ width: `${s.pct}%` }}>
                    <span className="text-[9px] font-bold text-white">{s.count}</span>
                  </div>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />Supplier Spend Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2.5">
            {supplierSpend.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No spend data yet.</p>
            ) : supplierSpend.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="w-5 shrink-0 text-center text-[10px] font-bold text-muted-foreground/50">{i + 1}</div>
                <div className="w-28 shrink-0 text-xs font-medium truncate">{s.name}</div>
                <div className="flex-1 h-4 rounded-full bg-muted/50 overflow-hidden">
                  <div className="h-full rounded-full bg-purple-500" style={{ width: `${s.pct}%` }} />
                </div>
                <span className="text-xs font-semibold w-20 text-right">{formatCurrency(s.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search PO# or supplier…" value={search} onChange={e => setSearch(e.target.value)}
          className="h-8 w-52 text-xs" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            {Object.entries(STATUS_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDelivery} onValueChange={setFilterDelivery}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Delivery status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Delivery</SelectItem>
            {DELIVERY_STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="h-8 w-36 text-xs" />
        <span className="text-xs text-muted-foreground">–</span>
        <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="h-8 w-36 text-xs" />
        {hasFilters && (
          <Button variant="outline" size="sm" className="h-8 text-xs"
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterDelivery(''); setFilterFrom(''); setFilterTo('') }}>
            <X className="h-3.5 w-3.5 mr-1" />Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground/60">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <DataTable
        columns={[
          { key: 'poNumber', header: 'PO Number', sortable: true, render: (po: PO) => (
            <Link href={`/procurement/purchase-orders/${po.id}`}
              className="font-mono font-semibold text-blue-600 hover:text-blue-800">
              {po.poNumber}
            </Link>
          )},
          { key: 'vendor.name', header: 'Supplier', render: (po: PO) => (
            <span className="font-medium">{po.vendor.name}</span>
          )},
          { key: 'orderDate', header: 'Order Date', sortable: true, render: (po: PO) => (
            <span className="text-muted-foreground">{formatDate(po.orderDate)}</span>
          )},
          { key: 'deliveryDate', header: 'Delivery Date', sortable: true, render: (po: PO) => {
            if (!po.deliveryDate) return <span className="text-muted-foreground/40">—</span>
            const delayed = isDelayed(po)
            const days = daysUntil(po.deliveryDate)
            const overdue = delayed && days < 0
            return (
              <span className={cn('font-medium', overdue ? 'text-red-600' : days <= 3 ? 'text-amber-600' : '')}>
                {formatDate(po.deliveryDate)}
                {overdue && <span className="ml-1 text-[9px] font-bold text-red-500">OVERDUE</span>}
                {!overdue && days <= 3 && days >= 0 && <span className="ml-1 text-[9px] font-bold text-amber-500">{days}d</span>}
              </span>
            )
          }},
          { key: 'grandTotal', header: 'Amount', sortable: true, render: (po: PO) => (
            <span className="font-semibold">{formatCurrency(Number(po.grandTotal))}</span>
          )},
          { key: 'grns', header: 'GRNs', render: (po: PO) => (
            (po._count?.grns ?? 0) > 0
              ? <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">{po._count!.grns}</span>
              : <span className="text-muted-foreground/30">—</span>
          )},
          { key: 'status', header: 'Status', render: (po: PO) => <StatusPill status={po.status} /> },
        ]}
        data={filtered}
        isLoading={isLoading} error={error}
        virtualized
        actions={(po: PO) => (
          <div className="flex items-center justify-end gap-1">
            {po.status === 'PENDING_APPROVAL' && (
              <>
                <button onClick={() => updateMutation.mutate({ id: po.id, status: 'APPROVED' })}
                  className="rounded-md bg-emerald-100 p-1 text-emerald-700 hover:bg-emerald-200">
                  <CheckCircle className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => updateMutation.mutate({ id: po.id, status: 'CANCELLED' })}
                  className="rounded-md bg-red-100 p-1 text-red-600 hover:bg-red-200">
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status) && (
              <Link href={`/procurement/goods-receipt/new?poId=${po.id}`}
                className="rounded-md bg-purple-100 p-1 text-purple-700 hover:bg-purple-200">
                <Package className="h-3.5 w-3.5" />
              </Link>
            )}
            <Link href={`/procurement/purchase-orders/${po.id}`}
              className="rounded-md bg-muted p-1 text-muted-foreground hover:bg-muted/80">
              <Eye className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      />
    </div>
  )
}
