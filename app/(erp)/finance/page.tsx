'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getAppCurrencySymbol } from '@/lib/currency-store'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
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
  DollarSign, TrendingUp, TrendingDown, Building2, CreditCard,
  Landmark, FileText, BarChart2, RefreshCw, AlertTriangle, CheckCircle, BookOpen, Plus,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type FinanceDash = {
  cashBalance: number
  arOutstanding: number
  apOutstanding: number
  revenueThisMonth: number
  expensesThisMonth: number
  netProfitMtd: number
  bankAccounts: Array<{ id: string; accountName: string; accountType: string; currentBalance: number; currency: string }>
  monthlyPnL: Array<{ month: string; revenue: number; expenses: number; profit: number }>
  arAging: { current: number; days30: number; days60: number; days90plus: number }
  recentJournals: Array<{ id: string; entryNumber: string; description: string; totalDebit: number; date: string; status: string }>
  expenseBreakdown: Array<{ name: string; value: number }>
}

const MODULE_SHORTCUTS = [
  { href: '/finance/bank-accounts', label: 'Bank Accounts', icon: Landmark, color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
  { href: '/finance/journal', label: 'Journal Entries', icon: FileText, color: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' },
  { href: '/finance/reports/pnl', label: 'P&L Statement', icon: TrendingUp, color: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
  { href: '/finance/reports/ar-aging', label: 'AR Ageing', icon: TrendingDown, color: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100' },
  { href: '/finance/reports/ap-aging', label: 'AP Ageing', icon: TrendingDown, color: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' },
  { href: '/finance/bank-reconciliation', label: 'Reconciliation', icon: RefreshCw, color: 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100' },
]

const AR_AGING_COLORS = { current: '#10b981', days30: '#f59e0b', days60: '#ef4444', days90plus: '#7f1d1d' }

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/60 bg-white px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-muted-foreground mb-1">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function FinancePage() {
  const router = useRouter()
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['finance-dash'],
    queryFn: () => api.get<FinanceDash>('/api/finance/dashboard').then(r => r.data!),
    staleTime: 120_000,
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

  const arAgingData = d ? [
    { name: 'Current', value: d.arAging.current, color: AR_AGING_COLORS.current },
    { name: '1–30 days', value: d.arAging.days30, color: AR_AGING_COLORS.days30 },
    { name: '31–60 days', value: d.arAging.days60, color: AR_AGING_COLORS.days60 },
    { name: '90+ days', value: d.arAging.days90plus, color: AR_AGING_COLORS.days90plus },
  ].filter(x => x.value > 0) : []

  const profitPositive = (d?.netProfitMtd ?? 0) >= 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Financial overview, cash flow, accounts receivable and payable"
        icon={DollarSign}
        iconColor="text-green-600"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/finance/reports/pnl">
                <BarChart2 className="mr-1.5 h-3.5 w-3.5" />
                P&amp;L Report
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/finance/journal">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Journal Entry
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          title="Cash Position"
          value={formatCurrency(d?.cashBalance ?? 0)}
          icon={Building2}
          iconColor="text-teal-600"
          accent="bg-teal-500"
          description={`${d?.bankAccounts.length ?? 0} account(s)`}
          onClick={() => router.push('/finance/bank-accounts')}
        />
        <StatCard
          title="Revenue MTD"
          value={formatCurrency(d?.revenueThisMonth ?? 0)}
          icon={TrendingUp}
          iconColor="text-emerald-600"
          accent="bg-emerald-500"
          changeType="positive"
        />
        <StatCard
          title="Expenses MTD"
          value={formatCurrency(d?.expensesThisMonth ?? 0)}
          icon={TrendingDown}
          iconColor="text-orange-500"
          accent="bg-orange-500"
        />
        <StatCard
          title="Net Profit MTD"
          value={formatCurrency(d?.netProfitMtd ?? 0)}
          icon={BarChart2}
          iconColor={profitPositive ? 'text-blue-600' : 'text-red-600'}
          accent={profitPositive ? 'bg-blue-500' : 'bg-red-500'}
          changeType={profitPositive ? 'positive' : 'negative'}
          change={profitPositive ? 'Profitable' : 'Net loss'}
        />
        <StatCard
          title="AR Outstanding"
          value={formatCurrency(d?.arOutstanding ?? 0)}
          icon={CreditCard}
          iconColor={(d?.arAging.days90plus ?? 0) > 0 ? 'text-red-500' : 'text-amber-500'}
          accent={(d?.arAging.days90plus ?? 0) > 0 ? 'bg-red-500' : 'bg-amber-500'}
          urgent={(d?.arAging.days90plus ?? 0) > 0}
          onClick={() => router.push('/finance/reports/ar-aging')}
        />
        <StatCard
          title="AP Outstanding"
          value={formatCurrency(d?.apOutstanding ?? 0)}
          icon={FileText}
          iconColor="text-purple-600"
          accent="bg-purple-500"
          onClick={() => router.push('/finance/reports/ap-aging')}
        />
      </div>

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

      {/* P&L Chart + AR Aging */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-1 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-indigo-500" />
                Monthly P&amp;L
              </CardTitle>
              <span className="text-xs text-muted-foreground">Last 6 months</span>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {(d?.monthlyPnL ?? []).length === 0 ? (
              <EmptyState icon={BarChart2} title="No P&L data" className="py-8" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d?.monthlyPnL ?? []} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${getAppCurrencySymbol()}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="profit" name="Profit" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* AR Aging */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">AR Ageing</CardTitle>
              {(d?.arAging.days90plus ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" /> Overdue
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {arAgingData.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
                <p className="text-xs text-muted-foreground">All invoices current</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={arAgingData} cx="50%" cy="50%" innerRadius={36} outerRadius={55} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {arAgingData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {arAgingData.map((row) => (
                    <div key={row.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full inline-block flex-shrink-0" style={{ background: row.color }} />
                        <span className="text-muted-foreground">{row.name}</span>
                      </div>
                      <span className="font-semibold">{formatCurrency(row.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bank accounts + Recent journals */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Landmark className="h-4 w-4 text-teal-500" />
              Bank Accounts
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link href="/finance/bank-accounts">Manage</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.bankAccounts ?? []).length === 0 ? (
              <EmptyState icon={Landmark} title="No bank accounts" description="Add your first bank account" className="py-8" />
            ) : (
              <div className="space-y-2">
                {d?.bankAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50">
                        <Building2 className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-xs font-medium">{acc.accountName}</p>
                        <p className="text-[11px] text-muted-foreground">{acc.accountType} · {acc.currency}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold">{formatCurrency(acc.currentBalance)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-500" />
              Recent Journal Entries
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link href="/finance/journal">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.recentJournals ?? []).length === 0 ? (
              <EmptyState icon={BookOpen} title="No journal entries yet" className="py-8" />
            ) : (
              <div className="space-y-1.5">
                {(d?.recentJournals ?? []).map((j) => (
                  <Link key={j.id} href={`/finance/journal`}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/50 transition-colors group">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{j.entryNumber}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-40">{j.description} · {formatDate(j.date)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={j.status === 'POSTED' ? 'success' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {j.status}
                      </Badge>
                      <span className="text-xs font-bold">{formatCurrency(j.totalDebit)}</span>
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
