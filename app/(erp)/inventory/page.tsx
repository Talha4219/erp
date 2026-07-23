'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
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
import {
  Package, Warehouse, AlertTriangle, ArrowLeftRight,
  ClipboardList, QrCode, Plus, Tag, BarChart2,
  CheckCircle, Activity,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type InventoryDash = {
  totalItems: number
  totalStockValue: number
  lowStockCount: number
  outOfStockCount: number
  warehouseCount: number
  pendingTransfers: number
  stockMovements: Array<{ month: string; inbound: number; outbound: number }>
  lowStockItems: Array<{ id: string; name: string; sku: string; currentStock: number; reorderPoint: number; warehouse: string }>
  categoryDistribution: Array<{ name: string; count: number; value: number }>
  recentTransfers: Array<{ id: string; transferNumber: string; fromWarehouse: string; toWarehouse: string; status: string; createdAt: string }>
  topMovingItems: Array<{ name: string; sku: string; movement: number }>
}

const MODULE_SHORTCUTS = [
  { href: '/inventory/items', label: 'Items', icon: Package, color: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100' },
  { href: '/inventory/warehouses', label: 'Warehouses', icon: Warehouse, color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { href: '/inventory/stock-ledger', label: 'Stock Ledger', icon: BarChart2, color: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' },
  { href: '/inventory/transfers', label: 'Transfers', icon: ArrowLeftRight, color: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100' },
  { href: '/inventory/batches', label: 'Batch Tracking', icon: ClipboardList, color: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' },
  { href: '/inventory/serial-numbers', label: 'Serial Numbers', icon: QrCode, color: 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100' },
  { href: '/inventory/cycle-counts', label: 'Cycle Counts', icon: ClipboardList, color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
  { href: '/inventory/valuation', label: 'Valuation', icon: Tag, color: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
]

const TRANSFER_BADGE: Record<string, 'secondary' | 'warning' | 'success' | 'info'> = {
  DRAFT: 'secondary', IN_TRANSIT: 'warning', COMPLETED: 'success', PENDING: 'info',
}

const CAT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-muted-foreground mb-1">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export default function InventoryPage() {
  const router = useRouter()
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['inventory-dash'],
    queryFn: () => api.get<InventoryDash>('/api/inventory/dashboard').then(r => r.data!),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Track stock levels, movements, warehouses, and valuations"
        icon={Package}
        iconColor="text-orange-600"
        actions={
          <div className="flex gap-2">
            {(d?.lowStockCount ?? 0) > 0 && (
              <Button variant="outline" size="sm" asChild className="border-red-200 text-red-700 bg-red-50 hover:bg-red-100">
                <Link href="/inventory/items">
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                  {d!.lowStockCount} Low Stock
                </Link>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link href="/inventory/items">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Item
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          title="Total Items"
          value={d?.totalItems ?? 0}
          icon={Package}
          iconColor="text-orange-600"
          accent="bg-orange-500"
          onClick={() => router.push('/inventory/items')}
        />
        <StatCard
          title="Stock Value"
          value={formatCurrency(d?.totalStockValue ?? 0)}
          icon={Tag}
          iconColor="text-green-600"
          accent="bg-green-500"
          onClick={() => router.push('/inventory/valuation')}
        />
        <StatCard
          title="Low Stock"
          value={d?.lowStockCount ?? 0}
          icon={AlertTriangle}
          iconColor={(d?.lowStockCount ?? 0) > 0 ? 'text-red-500' : 'text-emerald-500'}
          accent={(d?.lowStockCount ?? 0) > 0 ? 'bg-red-500' : 'bg-emerald-500'}
          urgent={(d?.lowStockCount ?? 0) > 0}
          onClick={() => router.push('/inventory/items')}
          change={(d?.lowStockCount ?? 0) > 0 ? 'Below reorder point' : 'All stocked'}
          changeType={(d?.lowStockCount ?? 0) > 0 ? 'negative' : 'positive'}
        />
        <StatCard
          title="Out of Stock"
          value={d?.outOfStockCount ?? 0}
          icon={Package}
          iconColor={(d?.outOfStockCount ?? 0) > 0 ? 'text-red-600' : 'text-emerald-500'}
          accent={(d?.outOfStockCount ?? 0) > 0 ? 'bg-red-600' : 'bg-emerald-500'}
          urgent={(d?.outOfStockCount ?? 0) > 0}
        />
        <StatCard
          title="Warehouses"
          value={d?.warehouseCount ?? 0}
          icon={Warehouse}
          iconColor="text-blue-600"
          accent="bg-blue-500"
          onClick={() => router.push('/inventory/warehouses')}
        />
        <StatCard
          title="Pending Transfers"
          value={d?.pendingTransfers ?? 0}
          icon={ArrowLeftRight}
          iconColor="text-teal-600"
          accent="bg-teal-500"
          onClick={() => router.push('/inventory/transfers')}
        />
      </div>

      {/* Quick Access */}
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Quick Access</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
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

      {/* Stock movements + Category */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Stock Movements
              </CardTitle>
              <span className="text-xs text-muted-foreground">Last 6 months</span>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {(d?.stockMovements ?? []).length === 0 ? (
              <EmptyState icon={BarChart2} title="No movement data" className="py-8" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d?.stockMovements ?? []} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="inbound" name="Inbound" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="outbound" name="Outbound" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category distribution */}
        <Card >
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">By Category</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.categoryDistribution ?? []).length === 0 ? (
              <EmptyState icon={Package} title="No category data" className="py-6" />
            ) : (
              <div className="space-y-2.5">
                {(d?.categoryDistribution ?? []).map((cat, i) => {
                  const maxCount = Math.max(...(d?.categoryDistribution ?? []).map(x => x.count), 1)
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate max-w-[120px]">{cat.name}</span>
                        <span className="text-xs text-muted-foreground">{cat.count} items</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(cat.count / maxCount) * 100}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low stock alerts + Recent transfers */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card >
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Low Stock Alerts
              {(d?.lowStockCount ?? 0) > 0 && (
                <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-700 px-1">
                  {d!.lowStockCount}
                </span>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link href="/inventory/items">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.lowStockItems ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
                <p className="text-xs text-muted-foreground">All stock levels healthy</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(d?.lowStockItems ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/60 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.sku} · {item.warehouse}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-red-600">{item.currentStock} left</p>
                      <p className="text-[10px] text-muted-foreground">Reorder @ {item.reorderPoint}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card >
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-teal-500" />
              Recent Transfers
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link href="/inventory/transfers">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {(d?.recentTransfers ?? []).length === 0 ? (
              <EmptyState icon={ArrowLeftRight} title="No transfers yet" className="py-8" />
            ) : (
              <div className="space-y-2">
                {(d?.recentTransfers ?? []).map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{t.transferNumber}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{t.fromWarehouse} → {t.toWarehouse}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={TRANSFER_BADGE[t.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">
                        {t.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{formatDate(t.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
