'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getAppCurrencySymbol } from '@/lib/currency-store'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { WorkflowProgress } from '@/components/shared/WorkflowProgress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  DollarSign, AlertTriangle, Users, ShoppingCart, FileText, ClipboardList,
  TrendingUp, UserCheck, Truck, RotateCcw, CreditCard, Receipt,
  BookOpen, Percent, Plus, ArrowUpRight, Star, Activity,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const statusVariant: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'secondary'> = {
  PAID: 'success', OVERDUE: 'destructive', PARTIALLY_PAID: 'warning',
  SENT: 'info', DRAFT: 'secondary', CANCELLED: 'secondary',
  CONFIRMED: 'info', SHIPPED: 'warning', DELIVERED: 'success',
}

type SalesDashboard = {
  totalRevenue: number; outstanding: number; overdueCount: number; overdueAmount: number
  activeCustomers: number; openOrders: number
  monthlyRevenue: Array<{ month: string; revenue: number }>
  recentInvoices: Array<{ id: string; invoiceNumber: string; status: string; totalAmount: number; paidAmount: number; dueDate: string; customer: { name: string } }>
  topCustomers: Array<{ name: string; totalAmount: number }>
  recentOrders: Array<{ id: string; soNumber: string; status: string; totalAmount: number; orderDate: string; customer: { name: string } }>
  funnel: Array<{ stage: string; count: number }>
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
}

const MODULE_SHORTCUTS = [
  { href: '/customers', label: 'Customers', icon: UserCheck, color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { href: '/sales/quotations', label: 'Quotations', icon: FileText, color: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' },
  { href: '/sales/orders', label: 'Orders', icon: ClipboardList, color: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100' },
  { href: '/sales/delivery-notes', label: 'Deliveries', icon: Truck, color: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100' },
  { href: '/sales/invoices', label: 'Invoices', icon: DollarSign, color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
  { href: '/sales/payments', label: 'Payments', icon: CreditCard, color: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
  { href: '/sales/returns', label: 'Returns', icon: RotateCcw, color: 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100' },
  { href: '/sales/credit-notes', label: 'Credits', icon: Receipt, color: 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100' },
  { href: '/sales/price-lists', label: 'Price Lists', icon: BookOpen, color: 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100' },
  { href: '/sales/discounts', label: 'Discounts', icon: Percent, color: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100' },
]


function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-muted-foreground mb-1">{label}</p>
      <p className="font-bold text-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function SalesDashboardPage() {
  const router = useRouter()
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['sales-dashboard'],
    queryFn: () => api.get<SalesDashboard>('/api/sales/dashboard').then((r) => r.data!),
  })

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
        <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white border border-border/50" />)}
        </div>
      </div>
    )
  }


  const funnelByStage = Object.fromEntries((d?.funnel ?? []).map(f => [f.stage, f.count]))
  const salesWorkflow = [
    { label: 'Lead', done: (funnelByStage['Leads'] ?? 0) > 0 },
    { label: 'Quotation', done: (funnelByStage['Quotations'] ?? 0) > 0 },
    { label: 'Sales Order', done: (funnelByStage['Orders'] ?? 0) > 0 },
    { label: 'Delivery', done: (d?.openOrders ?? 0) < (funnelByStage['Orders'] ?? 0) },
    { label: 'Invoice', done: (funnelByStage['Invoices'] ?? 0) > 0 },
    { label: 'Payment', done: (d?.totalRevenue ?? 0) > 0 },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Monitor your revenue pipeline, orders, and customer performance"
        icon={TrendingUp}
        iconColor="text-emerald-600"
        actions={
          <div className="flex gap-2">
            {(d?.overdueCount ?? 0) > 0 && (
              <Button variant="outline" size="sm" asChild className="border-red-200 text-red-700 bg-red-50 hover:bg-red-100">
                <Link href="/sales/invoices">
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                  {d!.overdueCount} Overdue
                </Link>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link href="/sales/orders">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Order
              </Link>
            </Button>
          </div>
        }
      />

      {/* Sales Workflow */}
      <Card >
        <CardContent className="py-4 px-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Sales Workflow</p>
          <WorkflowProgress steps={salesWorkflow} />
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(d?.totalRevenue ?? 0)}
          icon={TrendingUp}
          iconColor="text-emerald-600"
          accent="bg-emerald-500"
          description="From paid invoices"
          changeType="positive"
        />
        <StatCard
          title="Outstanding AR"
          value={formatCurrency(d?.outstanding ?? 0)}
          icon={DollarSign}
          iconColor="text-amber-500"
          accent="bg-amber-500"
          description="Unpaid invoice balance"
          urgent={(d?.overdueAmount ?? 0) > 0}
          onClick={() => router.push('/finance/reports/ar-aging')}
        />
        <StatCard
          title="Active Customers"
          value={d?.activeCustomers ?? 0}
          icon={Users}
          iconColor="text-blue-600"
          accent="bg-blue-500"
          onClick={() => router.push('/customers')}
        />
        <StatCard
          title="Open Orders"
          value={d?.openOrders ?? 0}
          icon={ShoppingCart}
          iconColor="text-orange-600"
          accent="bg-orange-500"
          onClick={() => router.push('/sales/orders')}
        />
      </div>

      {/* Overdue alert banner */}
      {(d?.overdueCount ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">
            <strong>{d!.overdueCount} overdue invoice{d!.overdueCount > 1 ? 's' : ''}</strong> totalling{' '}
            <strong>{formatCurrency(d!.overdueAmount)}</strong> — immediate follow-up required.
          </p>
          <Button size="sm" variant="outline" className="flex-shrink-0 border-red-300 text-red-700 hover:bg-red-100" asChild>
            <Link href="/sales/invoices">Review</Link>
          </Button>
        </div>
      )}

      {/* Quick Access */}
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Quick Access</p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {MODULE_SHORTCUTS.map(({ href, label, icon: Icon, color }) => (
            <Link key={href} href={href}>
              <div className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-3 cursor-pointer transition-all', color)}>
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Revenue chart + Top Customers */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Monthly Revenue
              </CardTitle>
              <span className="text-xs text-muted-foreground">Last 6 months</span>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {(d?.monthlyRevenue ?? []).length === 0 ? (
              <EmptyState icon={TrendingUp} title="No revenue data yet" className="py-8" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={d?.monthlyRevenue ?? []} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${getAppCurrencySymbol()}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#revenueGradSales)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card >
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Top Customers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.topCustomers ?? []).length === 0 ? (
              <EmptyState icon={Users} title="No customer data" className="py-6" />
            ) : (
              <div className="space-y-3">
                {(d?.topCustomers ?? []).map((c, i) => {
                  const max = d!.topCustomers[0]?.totalAmount ?? 1
                  const pct = (c.totalAmount / max) * 100
                  return (
                    <div key={c.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-bold text-muted-foreground/40 w-4">{i + 1}</span>
                          <span className="text-xs font-medium truncate max-w-28">{c.name}</span>
                        </div>
                        <span className="text-xs font-semibold flex-shrink-0">{formatCurrency(c.totalAmount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sales Funnel + Top Selling Products */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card >
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-purple-500" />
              Sales Funnel
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2.5">
            {(d?.funnel ?? []).map((s, i) => {
              const max = Math.max(...(d?.funnel ?? []).map(f => f.count), 1)
              const pct = Math.max(6, Math.round((s.count / max) * 100))
              return (
                <div key={s.stage} className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 w-28 shrink-0">
                    <span className="text-xs text-muted-foreground/70 font-medium">{i + 1}</span>
                    <span className="text-xs font-semibold truncate">{s.stage}</span>
                  </div>
                  <div className="flex-1 h-5 rounded-full bg-muted/50 overflow-hidden">
                    <div className="h-full rounded-full flex items-center justify-end pr-2 bg-purple-500 transition-all" style={{ width: `${pct}%` }}>
                      <span className="text-[9px] font-bold text-white">{s.count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card >
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-orange-500" />
              Top Selling Products
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {(d?.topProducts ?? []).length === 0 ? (
              <EmptyState icon={ShoppingCart} title="No product sales yet" className="py-8" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d?.topProducts ?? []} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${getAppCurrencySymbol()}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
                  <Bar dataKey="revenue" name="Revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent invoices + Orders */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card >
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-500" />
              Recent Invoices
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link href="/sales/invoices">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.recentInvoices ?? []).length === 0 ? (
              <EmptyState icon={FileText} title="No invoices yet" className="py-8" />
            ) : (
              <div className="space-y-1.5">
                {(d?.recentInvoices ?? []).map((inv) => (
                  <Link key={inv.id} href={`/sales/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/50 transition-colors group">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{inv.invoiceNumber}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{inv.customer.name} · Due {formatDate(inv.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={statusVariant[inv.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">
                        {inv.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs font-bold">{formatCurrency(Number(inv.totalAmount))}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card >
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              Recent Orders
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link href="/sales/orders">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.recentOrders ?? []).length === 0 ? (
              <EmptyState icon={ShoppingCart} title="No orders yet" className="py-8" />
            ) : (
              <div className="space-y-1.5">
                {(d?.recentOrders ?? []).map((o) => (
                  <Link key={o.id} href={`/sales/orders/${o.id}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/50 transition-colors group">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{o.soNumber}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{o.customer.name} · {formatDate(o.orderDate)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={statusVariant[o.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">
                        {o.status}
                      </Badge>
                      <span className="text-xs font-bold">{formatCurrency(Number(o.totalAmount))}</span>
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
