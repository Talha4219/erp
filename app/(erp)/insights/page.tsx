'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatGBP } from '@/lib/uk-locale'
import { getAppCurrencySymbol } from '@/lib/currency-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false })
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false })
import {
  TrendingUp, Minus, DollarSign, ShoppingCart, Package,
  Users, ArrowUpRight, ArrowDownRight, AlertTriangle, Clock, Sparkles,
  BarChart2, PieChart as PieIcon, Activity, Globe, Truck, CreditCard,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
type InsightsKpis = {
  revenueMTD: number
  revenueYTD: number
  revenueMoMPct: number
  arOutstanding: number
  apDueThisWeek: number
  openSalesOrders: number
  openPurchaseOrders: number
  lowStockItems: number
  totalEmployees: number
  activeEmployees: number
  pendingLeaves: number
  pendingApprovals: number
}

type InsightsData = {
  kpis: InsightsKpis
  monthlyRevenue: Array<{ month: string; revenue: number }>
  monthlyOrders: Array<{ month: string; sales: number; purchase: number; salesValue: number; purchaseValue: number }>
  topVendors: Array<{ name: string; spend: number }>
}

const COLORS = {
  blue: '#3b82f6', emerald: '#10b981', amber: '#f59e0b', indigo: '#6366f1',
  red: '#ef4444', violet: '#8b5cf6', teal: '#14b8a6', sky: '#0ea5e9', rose: '#f43f5e',
}

const VENDOR_COLORS = [COLORS.blue, COLORS.emerald, COLORS.violet, COLORS.amber, COLORS.teal]

// ── Helpers ───────────────────────────────────────────────────────────────────
function KpiTile({
  title, value, sub, trend, icon: Icon, accent, urgent, href,
}: {
  title: string; value: string; sub?: string; trend?: number
  icon: React.ElementType; accent: string; urgent?: boolean; href?: string
}) {
  const trendUp = (trend ?? 0) > 0
  const trendDown = (trend ?? 0) < 0
  const content = (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md',
      urgent ? 'border-red-200 bg-red-50/40' : 'border-border/60 hover:border-border',
      href && 'cursor-pointer',
    )}>
      <div className={cn('absolute inset-x-0 top-0 h-[3px] rounded-t-xl', accent)} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{title}</p>
          <p className={cn('mt-1.5 text-xl font-bold leading-none tracking-tight', urgent && 'text-red-700')}>{value}</p>
          {(sub || trend != null) && (
            <div className="mt-1.5 flex items-center gap-1">
              {trendUp && <ArrowUpRight className="h-3 w-3 shrink-0 text-emerald-500" />}
              {trendDown && <ArrowDownRight className="h-3 w-3 shrink-0 text-red-500" />}
              {!trendUp && !trendDown && trend != null && <Minus className="h-3 w-3 shrink-0 text-muted-foreground" />}
              <span className={cn('text-[11px]', trendUp ? 'text-emerald-600' : trendDown ? 'text-red-500' : 'text-muted-foreground')}>
                {trend != null ? `${trend > 0 ? '+' : ''}${trend.toFixed(1)}% vs last month` : sub}
              </span>
            </div>
          )}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/40">
          <Icon className={cn('h-4 w-4', urgent ? 'text-red-500' : 'text-muted-foreground/60')} />
        </div>
      </div>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function ChartTooltip({ active, payload, label, currency }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>
  label?: string; currency?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/60 bg-white px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{currency !== false ? formatGBP(p.value) : p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['insights'],
    queryFn: () => api.get<InsightsData>('/api/analytics/insights').then(r => r.data!),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-80 animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white border border-border/50" />)}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-white border border-border/50" />)}
        </div>
      </div>
    )
  }

  if (error || !d) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border">
        <AlertTriangle className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Could not load insights data</p>
        <p className="text-xs text-muted-foreground/60">{(error as Error)?.message}</p>
      </div>
    )
  }

  const kpis = d.kpis

  // Peak revenue month
  const peakMonth = d.monthlyRevenue.reduce((a, b) => b.revenue > a.revenue ? b : a, { month: '—', revenue: 0 })

  // Revenue 12m total
  const totalRevenue12m = d.monthlyRevenue.reduce((s, m) => s + m.revenue, 0)

  // Order volume trend (last month vs prev month)
  const lastTwo = d.monthlyOrders.slice(-2)
  const ordersMoM = lastTwo.length === 2 && lastTwo[0].sales > 0
    ? ((lastTwo[1].sales - lastTwo[0].sales) / lastTwo[0].sales) * 100 : 0

  // Vendor data for pie chart
  const vendorPieData = d.topVendors.slice(0, 5).map((v, i) => ({
    name: v.name, value: v.spend, color: VENDOR_COLORS[i],
  }))
  const totalVendorSpend = vendorPieData.reduce((s, v) => s + v.value, 0)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100">
              <Sparkles className="h-4 w-4 text-sky-600" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Business Insights</h1>
            <Badge variant="secondary" className="text-[10px]">Live</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Cross-module business intelligence — 12-month view</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/reports"><BarChart2 className="mr-1.5 h-3.5 w-3.5" />Reports</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/finance"><TrendingUp className="mr-1.5 h-3.5 w-3.5" />Finance</Link>
          </Button>
        </div>
      </div>

      {/* Revenue KPIs */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Revenue</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile title="Revenue MTD" value={formatGBP(kpis.revenueMTD)}
            trend={kpis.revenueMoMPct} icon={TrendingUp} accent="bg-blue-500" href="/finance" />
          <KpiTile title="Revenue YTD" value={formatGBP(kpis.revenueYTD)}
            sub="Year to date" icon={DollarSign} accent="bg-emerald-500" href="/finance" />
          <KpiTile title="AR Outstanding" value={formatGBP(kpis.arOutstanding)}
            sub="Unpaid invoices" icon={CreditCard} accent="bg-amber-500"
            urgent={kpis.arOutstanding > 0} href="/sales/invoices" />
          <KpiTile title="AP Due This Week" value={formatGBP(kpis.apDueThisWeek)}
            sub="Vendor payments due ≤7 days" icon={AlertTriangle} accent="bg-orange-500"
            urgent={kpis.apDueThisWeek > 0} />
        </div>
      </div>

      {/* Operations KPIs */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Operations</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile title="Open Sales Orders" value={String(kpis.openSalesOrders)}
            sub="Active" icon={ShoppingCart} accent="bg-indigo-500" href="/sales/orders" />
          <KpiTile title="Open Purchase Orders" value={String(kpis.openPurchaseOrders)}
            sub="Active" icon={Truck} accent="bg-teal-500" href="/procurement/purchase-orders" />
          <KpiTile title="Low Stock Items" value={String(kpis.lowStockItems)}
            sub="Below reorder point" icon={Package} accent="bg-red-500"
            urgent={kpis.lowStockItems > 0} href="/inventory/items" />
          <KpiTile title="Pending Approvals" value={String(kpis.pendingApprovals)}
            sub="Awaiting action" icon={Clock} accent="bg-violet-500"
            urgent={kpis.pendingApprovals > 0} href="/workflow" />
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* 12-Month Revenue Trend */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-1 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-blue-500" />
                  Revenue Trend
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Last 12 months</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">12-Month Total</p>
                <p className="text-sm font-bold text-blue-700">{formatGBP(totalRevenue12m)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {d.monthlyRevenue.every(m => m.revenue === 0) ? (
              <div className="flex h-52 items-center justify-center">
                <p className="text-xs text-muted-foreground">No revenue data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={d.monthlyRevenue} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="insRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${getAppCurrencySymbol()}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke={COLORS.blue} strokeWidth={2.5}
                    fill="url(#insRevGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: COLORS.blue }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {/* Peak month callout */}
            {peakMonth.revenue > 0 && (
              <div className="mx-2 mt-1 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700">Peak month: <span className="font-semibold">{peakMonth.month}</span> — {formatGBP(peakMonth.revenue)}</p>
                <div className="ml-auto flex items-center gap-1">
                  {kpis.revenueMoMPct > 0 ? (
                    <><ArrowUpRight className="h-3 w-3 text-emerald-500" /><span className="text-xs font-semibold text-emerald-600">+{kpis.revenueMoMPct.toFixed(1)}% MoM</span></>
                  ) : kpis.revenueMoMPct < 0 ? (
                    <><ArrowDownRight className="h-3 w-3 text-red-500" /><span className="text-xs font-semibold text-red-600">{kpis.revenueMoMPct.toFixed(1)}% MoM</span></>
                  ) : (
                    <span className="text-xs text-muted-foreground">Flat MoM</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* HR Snapshot */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-pink-500" />
              Workforce Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-4">
            {/* Headcount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Active Employees</span>
                <span className="text-xs font-bold">{kpis.activeEmployees} / {kpis.totalEmployees}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-pink-400 transition-all"
                  style={{ width: kpis.totalEmployees > 0 ? `${(kpis.activeEmployees / kpis.totalEmployees) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {kpis.totalEmployees > 0 ? `${Math.round((kpis.activeEmployees / kpis.totalEmployees) * 100)}% active` : 'No employees'}
              </p>
            </div>

            {[
              { label: 'Total Headcount', value: kpis.totalEmployees, color: 'text-foreground', bg: 'bg-muted/40' },
              { label: 'Active Staff', value: kpis.activeEmployees, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Pending Leaves', value: kpis.pendingLeaves, color: kpis.pendingLeaves > 0 ? 'text-amber-700' : 'text-muted-foreground', bg: kpis.pendingLeaves > 0 ? 'bg-amber-50' : 'bg-muted/30' },
              { label: 'Pending Approvals', value: kpis.pendingApprovals, color: kpis.pendingApprovals > 0 ? 'text-violet-700' : 'text-muted-foreground', bg: kpis.pendingApprovals > 0 ? 'bg-violet-50' : 'bg-muted/30' },
            ].map(row => (
              <div key={row.label} className={cn('flex items-center justify-between rounded-lg px-3 py-2', row.bg)}>
                <span className="text-xs text-muted-foreground">{row.label}</span>
                <span className={cn('text-sm font-bold', row.color)}>{row.value}</span>
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full text-xs" asChild>
              <Link href="/hr">View HR Module <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Orders + Vendors Row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Monthly Orders Comparison */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-1 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5 text-indigo-500" />
                  Order Volume
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Sales vs Purchase — last 12 months</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-indigo-400" />Sales</div>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-teal-400" />Purchase</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {d.monthlyOrders.every(m => m.sales === 0 && m.purchase === 0) ? (
              <div className="flex h-52 items-center justify-center">
                <p className="text-xs text-muted-foreground">No order data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.monthlyOrders} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip currency={false} />} />
                  <Bar dataKey="sales" name="Sales Orders" fill={COLORS.indigo} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="purchase" name="Purchase Orders" fill={COLORS.teal} radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {/* MoM order trend */}
            {ordersMoM !== 0 && (
              <div className="mx-2 mt-1 flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-1.5">
                {ordersMoM > 0
                  ? <><ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /><p className="text-xs text-emerald-700">Sales orders up <span className="font-semibold">+{ordersMoM.toFixed(1)}%</span> vs prior month</p></>
                  : <><ArrowDownRight className="h-3.5 w-3.5 text-red-500" /><p className="text-xs text-red-700">Sales orders down <span className="font-semibold">{ordersMoM.toFixed(1)}%</span> vs prior month</p></>
                }
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Vendors */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-1 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-teal-500" />
              Top Vendors — YTD Spend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {vendorPieData.length === 0 ? (
              <div className="flex h-40 items-center justify-center">
                <p className="text-xs text-muted-foreground">No vendor spend data</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={vendorPieData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {vendorPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => formatGBP(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-2">
                  {vendorPieData.map((v) => {
                    const pct = totalVendorSpend > 0 ? Math.round((v.value / totalVendorSpend) * 100) : 0
                    return (
                      <div key={v.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: v.color }} />
                            <span className="text-[11px] truncate max-w-[100px]">{v.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground">{pct}%</span>
                            <span className="text-[11px] font-semibold">{formatGBP(v.value)}</span>
                          </div>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: v.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <span className="text-xs text-muted-foreground">Total Spend</span>
                  <span className="text-sm font-bold">{formatGBP(totalVendorSpend)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cross-Module Health Summary */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <PieIcon className="h-3.5 w-3.5 text-sky-500" />
            Business Health Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                module: 'Finance', status: kpis.arOutstanding === 0 && kpis.apDueThisWeek === 0 ? 'healthy' : kpis.arOutstanding > 0 ? 'warning' : 'ok',
                detail: kpis.arOutstanding > 0 ? `${formatGBP(kpis.arOutstanding)} AR outstanding` : 'No overdue receivables',
                href: '/finance',
              },
              {
                module: 'Sales', status: kpis.openSalesOrders > 0 ? 'ok' : 'neutral',
                detail: `${kpis.openSalesOrders} open orders`,
                href: '/sales',
              },
              {
                module: 'Inventory', status: kpis.lowStockItems > 5 ? 'warning' : kpis.lowStockItems > 0 ? 'ok' : 'healthy',
                detail: kpis.lowStockItems > 0 ? `${kpis.lowStockItems} items below reorder` : 'All stock levels healthy',
                href: '/inventory',
              },
              {
                module: 'HR', status: kpis.pendingLeaves > 5 ? 'warning' : kpis.pendingLeaves > 0 ? 'ok' : 'healthy',
                detail: kpis.pendingLeaves > 0 ? `${kpis.pendingLeaves} leave requests pending` : 'No pending leave requests',
                href: '/hr',
              },
            ].map(row => {
              const statusMap = {
                healthy: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-100', label: 'Healthy', text: 'text-emerald-700' },
                ok: { dot: 'bg-amber-400', bg: 'bg-amber-50 border-amber-100', label: 'Needs Attention', text: 'text-amber-700' },
                warning: { dot: 'bg-red-500 animate-pulse', bg: 'bg-red-50 border-red-100', label: 'Action Required', text: 'text-red-700' },
                neutral: { dot: 'bg-blue-400', bg: 'bg-blue-50 border-blue-100', label: 'Active', text: 'text-blue-700' },
              }
              const s = statusMap[row.status as keyof typeof statusMap]
              return (
                <Link key={row.module} href={row.href}>
                  <div className={cn('rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-all', s.bg)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold">{row.module}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full', s.dot)} />
                        <span className={cn('text-[10px] font-medium', s.text)}>{s.label}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{row.detail}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
