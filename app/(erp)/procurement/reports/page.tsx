'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart2, DollarSign, Package, Star, TrendingUp, Users } from 'lucide-react'

type ReportData = {
  topSuppliersBySpend: Array<{ vendor: { name: string; vendorCode: string }; totalSpend: number; poCount: number }>
  poStatusBreakdown: Array<{ status: string; count: number }>
  monthlySpend: Array<{ month: string; total: number }>
  supplierAvgRatings: Array<{ vendor: { name: string }; avgOverall: number; avgQuality: number; avgDelivery: number; avgPrice: number; ratingCount: number }>
  invoicePaymentStats: Array<{ status: string; count: number; total: number; paid: number }>
}

const STATUS_VARIANT: Record<string, 'secondary' | 'info' | 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'secondary', PENDING_APPROVAL: 'warning', APPROVED: 'info',
  PARTIALLY_RECEIVED: 'warning', FULLY_RECEIVED: 'success', CANCELLED: 'destructive',
}

function StarBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-yellow-400" style={{ width: `${(score / 5) * 100}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

function MonthLabel(month: string) {
  const [y, m] = month.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' })
}

export default function ProcurementReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['procurement-reports'],
    queryFn: () => api.get<ReportData>('/api/procurement/reports').then(r => r.data),
  })

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading reports…</div>
  if (!data) return null

  const totalSpend = data.topSuppliersBySpend.reduce((s, r) => s + r.totalSpend, 0)
  const totalInvoiced = data.invoicePaymentStats.reduce((s, r) => s + r.total, 0)
  const totalPaid = data.invoicePaymentStats.reduce((s, r) => s + r.paid, 0)
  const totalPOs = data.poStatusBreakdown.reduce((s, r) => s + r.count, 0)
  const maxMonthlySpend = Math.max(...data.monthlySpend.map(m => m.total), 1)

  return (
    <div className="space-y-6">
      <PageHeader title="Procurement Reports" description="Supplier performance and spending analytics" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Total Spend (POs)" value={formatCurrency(totalSpend)} icon={DollarSign} iconColor="text-blue-600" />
        <StatCard title="Total POs" value={totalPOs} icon={Package} iconColor="text-orange-600" />
        <StatCard title="Invoiced" value={formatCurrency(totalInvoiced)} icon={BarChart2} iconColor="text-purple-600" />
        <StatCard title="Outstanding" value={formatCurrency(totalInvoiced - totalPaid)} icon={TrendingUp} iconColor="text-red-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top suppliers by spend */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Top Suppliers by Spend</CardTitle></CardHeader>
          <CardContent>
            {data.topSuppliersBySpend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
            ) : (
              <div className="space-y-3">
                {data.topSuppliersBySpend.map((r, i) => {
                  const pct = totalSpend > 0 ? (r.totalSpend / totalSpend) * 100 : 0
                  return (
                    <div key={r.vendor.vendorCode} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{i + 1}. {r.vendor.name}</span>
                        <span className="text-muted-foreground">{formatCurrency(r.totalSpend)} · {r.poCount} PO{r.poCount !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PO status breakdown */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" />Purchase Order Status</CardTitle></CardHeader>
          <CardContent>
            {data.poStatusBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
            ) : (
              <div className="space-y-2">
                {data.poStatusBreakdown.map(r => (
                  <div key={r.status} className="flex items-center justify-between">
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'} className="text-xs">{r.status.replace(/_/g, ' ')}</Badge>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400" style={{ width: `${(r.count / Math.max(totalPOs, 1)) * 100}%` }} />
                      </div>
                      <span className="text-sm font-medium w-6 text-right">{r.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly spend trend */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" />Monthly Procurement Spend</CardTitle></CardHeader>
          <CardContent>
            {data.monthlySpend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data for the last 6 months.</p>
            ) : (
              <div className="space-y-2">
                {data.monthlySpend.map(m => (
                  <div key={m.month} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{MonthLabel(m.month)}</span>
                      <span className="font-medium">{formatCurrency(m.total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(m.total / maxMonthlySpend) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supplier performance ratings */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Star className="h-4 w-4" />Supplier Performance Ratings</CardTitle></CardHeader>
          <CardContent>
            {data.supplierAvgRatings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ratings submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {data.supplierAvgRatings.map(r => (
                  <div key={r.vendor.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{r.vendor.name}</span>
                      <span className="text-xs text-muted-foreground">{r.ratingCount} review{r.ratingCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <div><span>Overall</span><StarBar score={r.avgOverall} /></div>
                      <div><span>Quality</span><StarBar score={r.avgQuality} /></div>
                      <div><span>Delivery</span><StarBar score={r.avgDelivery} /></div>
                      <div><span>Price</span><StarBar score={r.avgPrice} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice payment breakdown */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4" />Invoice Payment Status</CardTitle></CardHeader>
        <CardContent>
          {data.invoicePaymentStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {data.invoicePaymentStats.map(r => (
                <div key={r.status} className="rounded-lg border p-3 text-center">
                  <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'} className="text-xs mb-2">{r.status.replace(/_/g, ' ')}</Badge>
                  <p className="text-lg font-bold">{r.count}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(r.total)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
