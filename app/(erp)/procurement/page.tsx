'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { getAppCurrencySymbol } from '@/lib/currency-store'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ShoppingCart, Package, Truck, ClipboardList, FileSearch, Receipt,
  CheckSquare, TrendingUp, AlertCircle, AlertTriangle, ArrowUpRight, Plus, Star,
  BarChart2, Activity, ChevronRight, Bell, Zap,
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })

// ─── Types ───────────────────────────────────────────────────────────────────

type PipelineStage = { stage: string; key: string; count: number; color: string; href: string }
type ActivityItem = { type: 'PR' | 'PO' | 'GRN'; id: string; ref: string; status: string; label: string; date: string }
type Dash = {
  totalVendors: number; openPOs: number; openPRs: number; pendingGRNs: number; totalUnpaid: number
  pendingApprovals: number; thisMonthSpend: number; pendingReturns: number
  recentPOs: Array<{ id: string; poNumber: string; status: string; grandTotal: number; orderDate: string; vendor: { name: string } }>
  monthlySpend: Array<{ month: string; total: number }>
  topSuppliers: Array<{ name: string; totalSpend: number; poCount: number }>
  activities: ActivityItem[]
  pipeline: PipelineStage[]
  overdueInvoices: { count: number; total: number }
  overdueDeliveries: number
  avgCycleTimeDays: number | null
  fullyReceivedThisMonth: number
  funnel: Array<{ stage: string; count: number; color: string }>
  supplierPerformance: Array<{ name: string; score: number }>
}

// ─── Status styling ───────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-600 border-gray-200',
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  PARTIALLY_RECEIVED: 'bg-violet-50 text-violet-700 border-violet-200',
  FULLY_RECEIVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-600 border-red-200',
  RECEIVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PO_CREATED: 'bg-blue-50 text-blue-700 border-blue-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' })
}

function SpendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/60 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-muted-foreground mb-1">{label}</p>
      <p className="font-bold">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProcurementPage() {
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['proc-dash'],
    queryFn: () => api.get<Dash>('/api/procurement/dashboard').then(r => r.data!),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const chartData = (d?.monthlySpend ?? []).map(m => ({ month: monthLabel(m.month), total: m.total }))
  const totalSpend = chartData.reduce((s, m) => s + m.total, 0)
  const lastMonthTotal = chartData[chartData.length - 2]?.total ?? 0
  const thisMonthTotal = d?.thisMonthSpend ?? 0
  const spendMoM = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0

  const totalSupplierSpend = (d?.topSuppliers ?? []).reduce((s, v) => s + v.totalSpend, 0)

  const pendingActivities = (d?.activities ?? [])
    .filter(a => ['PENDING', 'PENDING_APPROVAL', 'DRAFT'].includes(a.status))
    .slice(0, 5)

  const urgentAlerts = [
    (d?.overdueDeliveries ?? 0) > 0
      ? { icon: Truck, text: `${d!.overdueDeliveries} overdue deliveries`, href: '/procurement/purchase-orders' }
      : null,
    (d?.overdueInvoices?.count ?? 0) > 0
      ? { icon: Receipt, text: `${d!.overdueInvoices.count} overdue invoices (${formatCurrency(d!.overdueInvoices.total)})`, href: '/procurement/purchase-invoices' }
      : null,
    (d?.pendingReturns ?? 0) > 0
      ? { icon: AlertCircle, text: `${d!.pendingReturns} pending returns`, href: '/procurement/returns' }
      : null,
  ].filter(Boolean) as Array<{ icon: React.FC<{ className?: string }>; text: string; href: string }>

  if (error) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-200 dark:border-red-900">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm font-medium text-red-600 dark:text-red-400">Failed to load dashboard data</p>
        <p className="text-xs text-muted-foreground/60">{(error as Error)?.message}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-36 animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Section 1: Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 p-6 shadow-lg">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 0%, transparent 55%)' }} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-1">Procurement Control Center</p>
            <h1 className="text-2xl font-bold text-white">Procurement Dashboard</h1>
            <p className="text-sm text-white/60 mt-1">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {d?.totalVendors ? ` · ${d.totalVendors} active suppliers` : ''}
              {d?.avgCycleTimeDays ? ` · Avg cycle ${d.avgCycleTimeDays}d` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" asChild>
              <Link href="/procurement/purchase-requests">
                <Plus className="mr-1.5 h-3.5 w-3.5" />Purchase Request
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" asChild>
              <Link href="/procurement/rfqs">
                <FileSearch className="mr-1.5 h-3.5 w-3.5" />New RFQ
              </Link>
            </Button>
            <Button size="sm" className="bg-white text-teal-700 hover:bg-white/90 font-semibold" asChild>
              <Link href="/procurement/purchase-orders/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />New PO
              </Link>
            </Button>
          </div>
        </div>

        {/* Urgent alert pills */}
        {urgentAlerts.length > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-2">
            {urgentAlerts.map((alert, i) => (
              <Link key={i} href={alert.href}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-300/30 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500/30 transition-colors">
                <alert.icon className="h-3.5 w-3.5 text-red-200" />
                {alert.text}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

        {/* Purchase Requests */}
        <Link href="/procurement/purchase-requests">
          <div className="group flex flex-col rounded-xl border border-border/60 bg-white p-4 shadow-sm hover:border-purple-200 hover:shadow-md transition-all h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Requests</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50">
                <ClipboardList className="h-3.5 w-3.5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold">{d?.openPRs ?? 0}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Open requests</p>
            <div className="mt-2 h-0.5 rounded-full bg-purple-400" />
          </div>
        </Link>

        {/* Pending Approvals */}
        <Link href="/procurement/approval-center">
          <div className={cn(
            'group flex flex-col rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-all h-full',
            (d?.pendingApprovals ?? 0) > 0 ? 'border-amber-200 ring-1 ring-amber-100' : 'border-border/60',
          )}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Approvals</span>
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', (d?.pendingApprovals ?? 0) > 0 ? 'bg-amber-50' : 'bg-gray-50')}>
                <CheckSquare className={cn('h-3.5 w-3.5', (d?.pendingApprovals ?? 0) > 0 ? 'text-amber-600' : 'text-gray-400')} />
              </div>
            </div>
            <p className={cn('text-2xl font-bold', (d?.pendingApprovals ?? 0) > 0 ? 'text-amber-600' : '')}>{d?.pendingApprovals ?? 0}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{(d?.pendingApprovals ?? 0) > 0 ? 'Action required' : 'All approved'}</p>
            <div className={cn('mt-2 h-0.5 rounded-full', (d?.pendingApprovals ?? 0) > 0 ? 'bg-amber-400' : 'bg-gray-200')} />
          </div>
        </Link>

        {/* Open POs */}
        <Link href="/procurement/purchase-orders">
          <div className="group flex flex-col rounded-xl border border-border/60 bg-white p-4 shadow-sm hover:border-teal-200 hover:shadow-md transition-all h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Open POs</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50">
                <ShoppingCart className="h-3.5 w-3.5 text-teal-600" />
              </div>
            </div>
            <p className="text-2xl font-bold">{d?.openPOs ?? 0}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Active orders</p>
            <div className="mt-2 h-0.5 rounded-full bg-teal-400" />
          </div>
        </Link>

        {/* Monthly Spend */}
        <div className="flex flex-col rounded-xl border border-border/60 bg-white p-4 shadow-sm h-full">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Monthly Spend</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
            </div>
          </div>
          <p className="text-xl font-bold leading-tight">{formatCurrency(thisMonthTotal)}</p>
          <p className={cn('text-[11px] mt-1 font-medium', spendMoM > 0 ? 'text-red-500' : 'text-emerald-500')}>
            {spendMoM >= 0 ? '↑' : '↓'} {Math.abs(spendMoM).toFixed(1)}% vs last month
          </p>
          <div className="mt-2 h-0.5 rounded-full bg-blue-400" />
        </div>

        {/* Pending Deliveries */}
        <Link href="/procurement/goods-receipt">
          <div className={cn(
            'group flex flex-col rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-all h-full',
            (d?.overdueDeliveries ?? 0) > 0 ? 'border-red-200' : 'border-border/60',
          )}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deliveries</span>
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', (d?.overdueDeliveries ?? 0) > 0 ? 'bg-red-50' : 'bg-orange-50')}>
                <Truck className={cn('h-3.5 w-3.5', (d?.overdueDeliveries ?? 0) > 0 ? 'text-red-500' : 'text-orange-500')} />
              </div>
            </div>
            <p className="text-2xl font-bold">{d?.pendingGRNs ?? 0}</p>
            <p className={cn('text-[11px] mt-1', (d?.overdueDeliveries ?? 0) > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
              {(d?.overdueDeliveries ?? 0) > 0 ? `${d!.overdueDeliveries} overdue` : 'All on track'}
            </p>
            <div className={cn('mt-2 h-0.5 rounded-full', (d?.overdueDeliveries ?? 0) > 0 ? 'bg-red-400' : 'bg-orange-300')} />
          </div>
        </Link>

        {/* Outstanding Bills */}
        <Link href="/procurement/purchase-invoices">
          <div className={cn(
            'group flex flex-col rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-all h-full',
            (d?.totalUnpaid ?? 0) > 0 ? 'border-red-200' : 'border-border/60',
          )}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Supplier Bills</span>
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', (d?.totalUnpaid ?? 0) > 0 ? 'bg-red-50' : 'bg-emerald-50')}>
                <Receipt className={cn('h-3.5 w-3.5', (d?.totalUnpaid ?? 0) > 0 ? 'text-red-500' : 'text-emerald-500')} />
              </div>
            </div>
            <p className={cn('text-xl font-bold leading-tight', (d?.totalUnpaid ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600')}>
              {formatCurrency(d?.totalUnpaid ?? 0)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {d?.overdueInvoices?.count ? `${d.overdueInvoices.count} overdue` : 'All current'}
            </p>
            <div className={cn('mt-2 h-0.5 rounded-full', (d?.totalUnpaid ?? 0) > 0 ? 'bg-red-400' : 'bg-emerald-400')} />
          </div>
        </Link>
      </div>

      {/* ── Section 3+4: Spend Trend + Approval Center ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Spend Trend */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-1 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-teal-500" />
                Procurement Spend Trend
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-xs font-semibold rounded-full px-2 py-0.5',
                  spendMoM > 15 ? 'bg-red-50 text-red-600' : spendMoM > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600',
                )}>
                  {spendMoM >= 0 ? '+' : ''}{spendMoM.toFixed(1)}% MoM
                </span>
                <span className="text-xs text-muted-foreground">6-month trend</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {chartData.length === 0 ? (
              <EmptyState icon={BarChart2} title="No spend data yet" description="Purchase order data will appear here" className="py-8" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => `${getAppCurrencySymbol()}${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false} tickLine={false} width={44}
                    />
                    <Tooltip content={<SpendTooltip />} />
                    <Area
                      type="monotone" dataKey="total" name="Spend"
                      stroke="#14b8a6" strokeWidth={2.5}
                      fill="url(#spendGrad)" dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: '#14b8a6' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex gap-6 border-t border-border/40 px-4 pt-3 pb-1">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">6-Month Total</p>
                    <p className="text-sm font-bold">{formatCurrency(totalSpend)}</p>
                  </div>
                  <div className="border-l border-border/40 pl-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">This Month</p>
                    <p className="text-sm font-bold">{formatCurrency(thisMonthTotal)}</p>
                  </div>
                  <div className="border-l border-border/40 pl-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Monthly Avg</p>
                    <p className="text-sm font-bold">{formatCurrency(chartData.length ? totalSpend / chartData.length : 0)}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Approval Center */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-amber-500" />
                Approval Center
              </CardTitle>
              {(d?.pendingApprovals ?? 0) > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {d!.pendingApprovals}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {pendingActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 mb-3">
                  <CheckSquare className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">No pending approvals</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingActivities.map((act, i) => {
                  const Icon = act.type === 'PR' ? ClipboardList : ShoppingCart
                  const href = act.type === 'PR'
                    ? `/procurement/purchase-requests/${act.id}`
                    : `/procurement/purchase-orders/${act.id}`
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
                        <Icon className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{act.ref}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{act.label}</p>
                      </div>
                      <Link href={href} className="flex-shrink-0">
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-amber-200 text-amber-700 hover:bg-amber-100">
                          Review
                        </Button>
                      </Link>
                    </div>
                  )
                })}
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground mt-1" asChild>
                  <Link href="/procurement/approval-center">
                    View all approvals <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Section 5+6: Procurement Funnel + Supplier Performance ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Procurement Pipeline Funnel */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-indigo-500" />
                Procurement Pipeline
              </CardTitle>
              <span className="text-xs text-muted-foreground">Documents in each stage</span>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {(d?.funnel ?? []).length === 0 || (d?.funnel[0]?.count ?? 0) === 0 ? (
              <EmptyState icon={Zap} title="No procurement activity yet" className="py-8" />
            ) : (
              <>
                <div className="space-y-2.5">
                  {(d?.funnel ?? []).map((stage, i, arr) => {
                    const maxCount = arr[0].count || 1
                    const pct = Math.max(2, (stage.count / maxCount) * 100)
                    const drop = i > 0 ? arr[i - 1].count - stage.count : 0
                    return (
                      <div key={stage.stage} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-32 shrink-0 text-right">{stage.stage}</span>
                        <div className="flex-1 h-7 rounded-md bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-md flex items-center transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: stage.color }}
                          >
                            <span className="text-[11px] font-bold text-white px-2 whitespace-nowrap">{stage.count}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground/50 w-8 shrink-0">
                          {drop > 0 ? `-${drop}` : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/40">
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">{d!.funnel[0].count}</p>
                    <p className="text-[10px] text-muted-foreground">In Pipeline</p>
                  </div>
                  <div className="border-l border-border/40 pl-4 text-center">
                    <p className="text-lg font-bold text-emerald-600">{d!.funnel[d!.funnel.length - 1].count}</p>
                    <p className="text-[10px] text-muted-foreground">Paid</p>
                  </div>
                  <div className="border-l border-border/40 pl-4 text-center">
                    <p className="text-lg font-bold text-amber-600">{d!.funnel[0].count - d!.funnel[d!.funnel.length - 1].count}</p>
                    <p className="text-[10px] text-muted-foreground">In Progress</p>
                  </div>
                  <div className="border-l border-border/40 pl-4 text-center">
                    <p className="text-lg font-bold text-foreground">
                      {((d!.funnel[d!.funnel.length - 1].count / d!.funnel[0].count) * 100).toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Conversion</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Supplier Performance */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Supplier Performance
              </CardTitle>
              <Link href="/procurement/supplier-ratings" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-4 mb-4">
              {(d?.supplierPerformance ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No supplier ratings recorded yet.</p>
              ) : (d?.supplierPerformance ?? []).map((s, i) => (
                <div key={s.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-bold text-muted-foreground/40 w-4 shrink-0">{i + 1}</span>
                      <span className="text-xs font-medium truncate">{s.name}</span>
                    </div>
                    <span className={cn(
                      'text-xs font-bold shrink-0 ml-2',
                      s.score >= 90 ? 'text-emerald-600' : s.score >= 80 ? 'text-amber-600' : 'text-red-500',
                    )}>{s.score}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', s.score >= 90 ? 'bg-emerald-500' : s.score >= 80 ? 'bg-amber-400' : 'bg-red-400')}
                      style={{ width: `${s.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Top suppliers by YTD spend */}
            {(d?.topSuppliers ?? []).length > 0 && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">By YTD Spend</p>
                {(d?.topSuppliers ?? []).slice(0, 4).map((s) => {
                  const pct = totalSupplierSpend > 0 ? (s.totalSpend / totalSupplierSpend) * 100 : 0
                  return (
                    <div key={s.name} className="flex items-center justify-between py-1">
                      <span className="text-xs truncate max-w-[7rem]">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                        <span className="text-xs font-semibold">{formatCurrency(s.totalSpend)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Section 7: Open POs Table ── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-teal-500" />
            Open Purchase Orders
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
            <Link href="/procurement/purchase-orders">
              View all <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {(d?.recentPOs ?? []).length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No purchase orders yet" className="py-6" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    {['PO Number', 'Supplier', 'Amount', 'Date', 'Status', ''].map((h) => (
                      <th key={h} className={cn('pb-2.5 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]', h === 'Amount' ? 'text-right' : 'text-left', h === '' ? 'w-16' : '')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(d?.recentPOs ?? []).map(po => (
                    <tr key={po.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="py-3 pr-4">
                        <Link href={`/procurement/purchase-orders/${po.id}`} className="font-semibold text-blue-600 hover:text-blue-800">
                          {po.poNumber}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="truncate block max-w-36">{po.vendor.name}</span>
                      </td>
                      <td className="py-3 pr-4 text-right font-bold">{formatCurrency(Number(po.grandTotal))}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{formatDate(po.orderDate)}</td>
                      <td className="py-3 pr-4">
                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', STATUS_STYLE[po.status] ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
                          {po.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Link href={`/procurement/purchase-orders/${po.id}`}>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                            View <ChevronRight className="ml-0.5 h-3 w-3" />
                          </Button>
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

      {/* ── Section 8+10: Delivery Monitoring + Recent Activity ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Delivery Monitoring */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-500" />
                Delivery Monitoring
              </CardTitle>
              <Link href="/procurement/goods-receipt" className="text-xs text-muted-foreground hover:text-foreground">View GRNs</Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {/* Status summary */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-center">
                <p className="text-2xl font-bold text-orange-600">{d?.pendingGRNs ?? 0}</p>
                <p className="text-[10px] font-semibold text-orange-500 mt-0.5">Pending</p>
              </div>
              <div className={cn('rounded-xl border p-3 text-center', (d?.overdueDeliveries ?? 0) > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100')}>
                <p className={cn('text-2xl font-bold', (d?.overdueDeliveries ?? 0) > 0 ? 'text-red-600' : 'text-gray-300')}>{d?.overdueDeliveries ?? 0}</p>
                <p className={cn('text-[10px] font-semibold mt-0.5', (d?.overdueDeliveries ?? 0) > 0 ? 'text-red-500' : 'text-gray-400')}>Delayed</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{d?.fullyReceivedThisMonth ?? 0}</p>
                <p className="text-[10px] font-semibold text-emerald-500 mt-0.5">Received</p>
              </div>
            </div>

            {/* Delivery timeline */}
            <div className="space-y-3">
              {[
                { label: 'PO Created & Sent', done: true },
                { label: 'Supplier Confirmed', done: (d?.openPOs ?? 0) > 0 },
                { label: 'Shipment in Transit', done: (d?.pendingGRNs ?? 0) > 0 },
                { label: 'GRN Received', done: (d?.fullyReceivedThisMonth ?? 0) > 0 },
                { label: 'Invoice Matched & Paid', done: false },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn(
                    'h-5 w-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold',
                    step.done ? 'bg-emerald-500 text-white' : 'bg-muted border-2 border-muted-foreground/20 text-muted-foreground/40',
                  )}>
                    {step.done ? '✓' : i + 1}
                  </div>
                  <span className={cn('text-xs', step.done ? 'text-foreground font-medium' : 'text-muted-foreground')}>{step.label}</span>
                  {step.done && i < 4 && <span className="ml-auto text-[10px] text-emerald-500 font-medium">Done</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Recent Activity
              </CardTitle>
              <Bell className="h-3.5 w-3.5 text-muted-foreground/30" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {(d?.activities ?? []).length === 0 ? (
              <EmptyState icon={Activity} title="No recent activity" className="py-8" />
            ) : (
              <div className="space-y-1">
                {(d?.activities ?? []).slice(0, 8).map((act, i) => {
                  const Icon = act.type === 'PR' ? ClipboardList : act.type === 'PO' ? ShoppingCart : Package
                  const href = act.type === 'PR'
                    ? `/procurement/purchase-requests/${act.id}`
                    : act.type === 'PO'
                    ? `/procurement/purchase-orders/${act.id}`
                    : `/procurement/goods-receipt/${act.id}`
                  const iconCls = act.type === 'PR'
                    ? 'bg-purple-100 text-purple-600'
                    : act.type === 'PO'
                    ? 'bg-teal-100 text-teal-600'
                    : 'bg-orange-100 text-orange-600'
                  return (
                    <Link key={i} href={href}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors group -mx-2">
                      <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg', iconCls)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{act.ref}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{act.label}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className={cn('inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-semibold', STATUS_STYLE[act.status] ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
                          {act.status.replace(/_/g, ' ')}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(act.date)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
