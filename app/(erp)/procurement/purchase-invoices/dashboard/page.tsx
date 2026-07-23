'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, cn } from '@/lib/utils'
import { StatCard } from '@/components/shared/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Receipt, Clock, CalendarClock, AlertTriangle, CheckCircle2, GitCompareArrows, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false })
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false })

type Dash = {
  kpis: {
    totalPayables: number; pendingApproval: number; dueThisWeek: number
    overdueCount: number; overdueTotal: number; paidThisMonth: number; matchingExceptions: number
  }
  statusDistribution: Array<{ status: string; count: number }>
  payablesTrend: Array<{ month: string; received: number; paid: number; outstanding: number }>
  agingAnalysis: Array<{ bucket: string; amount: number }>
  recentInvoices: Array<{ id: string; invoiceNumber: string; status: string; totalAmount: number; vendor: { name: string } }>
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#94a3b8', SENT: '#3b82f6', PARTIALLY_PAID: '#f59e0b',
  PAID: '#10b981', OVERDUE: '#ef4444', CANCELLED: '#64748b',
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' })
}

export default function PurchaseInvoiceDashboardPage() {
  const { data: d, isLoading } = useQuery({
    queryKey: ['vendor-invoices-dashboard'],
    queryFn: () => api.get<Dash>('/api/procurement/vendor-invoices/dashboard').then(r => r.data!),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const trend = (d?.payablesTrend ?? []).map(t => ({ ...t, label: monthLabel(t.month) }))
  const statusData = (d?.statusDistribution ?? []).filter(s => s.count > 0)
  const aging = d?.agingAnalysis ?? []

  if (isLoading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/procurement/purchase-invoices"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold leading-tight">Purchase Invoice Dashboard</h1>
            <p className="text-xs text-muted-foreground">Financial verification & payment control center</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard title="Total Payables" value={formatCurrency(d?.kpis.totalPayables ?? 0)} icon={Receipt} iconColor="text-blue-600" accent="bg-blue-500" />
        <StatCard title="Pending Verification" value={d?.kpis.pendingApproval ?? 0} icon={Clock} iconColor="text-slate-600" accent="bg-slate-400" />
        <StatCard title="Due This Week" value={d?.kpis.dueThisWeek ?? 0} icon={CalendarClock} iconColor="text-amber-600" accent="bg-amber-500" />
        <StatCard title="Overdue Invoices" value={d?.kpis.overdueCount ?? 0} description={formatCurrency(d?.kpis.overdueTotal ?? 0)} icon={AlertTriangle} urgent={(d?.kpis.overdueCount ?? 0) > 0} accent="bg-red-500" />
        <StatCard title="Paid This Month" value={formatCurrency(d?.kpis.paidThisMonth ?? 0)} icon={CheckCircle2} iconColor="text-emerald-600" accent="bg-emerald-500" />
        <StatCard title="Matching Exceptions" value={d?.kpis.matchingExceptions ?? 0} icon={GitCompareArrows} iconColor="text-purple-600" accent="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card >
          <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Invoice Status Distribution</CardTitle></CardHeader>
          <CardContent className="px-5 pb-4">
            {statusData.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No invoices yet.</p> : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {statusData.map(s => <Cell key={s.status} fill={STATUS_COLOR[s.status] ?? '#94a3b8'} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {statusData.map(s => (
                    <div key={s.status} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s.status] ?? '#94a3b8' }} />
                      <span className="font-medium">{s.status.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground/60">({s.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card >
          <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Accounts Payable Trend</CardTitle></CardHeader>
          <CardContent className="px-5 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="received" name="Invoices Received" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="paid" name="Invoices Paid" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="outstanding" name="Outstanding Balance" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card >
          <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Invoice Aging Analysis</CardTitle></CardHeader>
          <CardContent className="px-5 pb-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={aging} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="bucket" tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {aging.map((a, i) => (
                    <Cell key={a.bucket} fill={['#22c55e', '#f59e0b', '#f97316', '#ef4444'][i] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card >
          <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Recent Invoices</CardTitle></CardHeader>
          <CardContent className="px-5 pb-4 space-y-1">
            {(d?.recentInvoices ?? []).length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No invoices yet.</p> : (d?.recentInvoices ?? []).map(inv => (
              <Link key={inv.id} href={`/procurement/purchase-invoices/${inv.id}`}
                className="flex items-center justify-between rounded-lg px-2 py-2 text-xs hover:bg-muted/40">
                <div>
                  <p className="font-semibold text-blue-600">{inv.invoiceNumber}</p>
                  <p className="text-muted-foreground">{inv.vendor.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(Number(inv.totalAmount))}</p>
                  <p className={cn('text-[10px] font-medium', inv.status === 'OVERDUE' ? 'text-red-600' : 'text-muted-foreground')}>{inv.status.replace(/_/g, ' ')}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
