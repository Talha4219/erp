'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KpiCards } from '@/components/modules/fulfillment/KpiCards'
import { FulfillmentStatusBadge } from '@/components/modules/fulfillment/FulfillmentStatusBadge'
import { FulfillmentMethodBadge } from '@/components/modules/fulfillment/FulfillmentMethodBadge'
import {
  Truck, Package, Plus, ArrowUpRight, ClipboardList, AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'

import { DashboardSkeleton } from '@/components/modules/fulfillment/FulfillmentSkeletons'

type DashboardData = {
  ordersPending: number
  approvedOrders: number
  inTransit: number
  deliveriesToday: number
  awaitingPickup: number
  returns: number
  recentOrders: Array<{ id: string; fulfillmentNumber: string; customer: { name: string }; status: string; method: string; requestedDate: string }>
}

export default function FulfillmentDashboardPage() {
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['fulfillment-dashboard'],
    queryFn: () => api.get<DashboardData>('/api/fulfillment/dashboard').then((r) => r.data!),
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

  if (isLoading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fulfillment"
        description="Manage picking, packing, deliveries, and logistics"
        icon={Truck}
        iconColor="text-indigo-600"
        actions={
          <Button size="sm" asChild>
            <Link href="/fulfillment/orders/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Order
            </Link>
          </Button>
        }
      />

      {d && <KpiCards data={d} />}

      {/* Recent Orders */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-500" />
            Recent Orders
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
            <Link href="/fulfillment/orders">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {(d?.recentOrders ?? []).length === 0 ? (
            <EmptyState icon={Package} title="No orders yet" className="py-8" />
          ) : (
            <div className="space-y-1.5">
              {(d?.recentOrders ?? []).map((o) => (
                <Link key={o.id} href={`/fulfillment/orders/${o.id}`}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/50 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium">{o.fulfillmentNumber}</p>
                      <FulfillmentStatusBadge status={o.status} />
                      <FulfillmentMethodBadge method={o.method} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{o.customer.name} · {formatDate(o.requestedDate)}</p>
                  </div>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
