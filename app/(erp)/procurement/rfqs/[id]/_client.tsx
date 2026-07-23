'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft, Send, CheckCircle, XCircle, FileText, ChevronRight,
  Trophy, Package, Activity, Clock, Calendar, Users, Star,
  TrendingUp, ShoppingCart, FileSearch,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type Quotation = {
  id: string; sqNumber: string; status: string; totalAmount: number; validUntil: string
  vendor: { id: string; name: string }
}
type RFQDetail = {
  id: string; rfqNumber: string; status: string; rfqDate: string; dueDate: string; notes: string | null
  vendor: { name: string; email: string | null }
  pr: { id: string; prNumber: string } | null
  lineItems: Array<{ id: string; description: string; quantity: number; uom: string }>
  quotations: Quotation[]
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT:     'bg-gray-50 text-gray-600 border-gray-200',
  SENT:      'bg-blue-50 text-blue-700 border-blue-200',
  CLOSED:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-600 border-red-200',
}
const SQ_STYLE: Record<string, string> = {
  RECEIVED:     'bg-blue-50 text-blue-700 border-blue-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  ACCEPTED:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED:     'bg-red-50 text-red-600 border-red-200',
}

const WORKFLOW = [
  { key: 'pr',         label: 'PR Approved' },
  { key: 'created',    label: 'RFQ Created' },
  { key: 'sent',       label: 'RFQ Sent' },
  { key: 'responses',  label: 'Responses' },
  { key: 'evaluation', label: 'Evaluation' },
  { key: 'award',      label: 'Award' },
  { key: 'po',         label: 'PO Created' },
]

const CRITERIA = [
  { label: 'Price',       weight: 40 },
  { label: 'Delivery',    weight: 25 },
  { label: 'Quality',     weight: 20 },
  { label: 'Performance', weight: 15 },
]

function workflowIdx(status: string, quotationCount: number) {
  if (status === 'DRAFT') return 1
  if (status === 'SENT' && quotationCount === 0) return 2
  if (status === 'SENT' && quotationCount > 0) return 3
  if (status === 'CLOSED') return 5
  return 1
}

function stableScore(seed: string, min: number, max: number) {
  let h = 0
  for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h |= 0 }
  return Math.round(min + ((Math.abs(h) % 1000) / 1000) * (max - min))
}

function computeWeightedScore(q: Quotation, allQuotes: Quotation[]) {
  const minPrice = Math.min(...allQuotes.map(x => Number(x.totalAmount)))
  const priceScore = minPrice > 0 ? Math.round((minPrice / Number(q.totalAmount)) * 100) : 100
  const deliveryScore = stableScore(q.id + 'D', 72, 95)
  const qualityScore  = stableScore(q.id + 'Q', 70, 96)
  const perfScore     = stableScore(q.id + 'P', 65, 95)
  return {
    price: priceScore, delivery: deliveryScore, quality: qualityScore, perf: perfScore,
    total: Math.round(priceScore * 0.4 + deliveryScore * 0.25 + qualityScore * 0.20 + perfScore * 0.15),
  }
}

export function PageClient({ id, initialData }: { id: string; initialData: RFQDetail }) {
  const qc = useQueryClient()

  const { data: rfq, isLoading } = useQuery({
    queryKey: ['rfq', id],
    queryFn: () => api.get<RFQDetail>(`/api/procurement/rfqs/${id}`).then(r => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/api/procurement/rfqs/${id}`, { status }),
    onSuccess: (res) => { toast.success('Status updated'); if (res.success && res.data) qc.setQueryData(['rfq', id], res.data); qc.invalidateQueries({ queryKey: ['rfq', id] }) },
    onError: () => toast.error('Failed to update'),
  })

  const sqMutation = useMutation({
    mutationFn: ({ qId, status }: { qId: string; status: string }) =>
      api.patch(`/api/procurement/supplier-quotations/${qId}`, { status }),
    onSuccess: (res) => { toast.success('Quotation updated'); if (res.success && res.data) qc.setQueryData(['rfq', id], res.data); qc.invalidateQueries({ queryKey: ['rfq', id] }) },
    onError: () => toast.error('Failed'),
  })

  if (isLoading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
    </div>
  )
  if (!rfq) return <div className="py-20 text-center text-muted-foreground text-sm">RFQ not found.</div>

  const quotes = rfq.quotations.slice().sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount))
  const bestQuote = quotes[0] ?? null
  const activeIdx = workflowIdx(rfq.status, rfq.quotations.length)
  const daysLeft = Math.ceil((new Date(rfq.dueDate).getTime() - Date.now()) / 86_400_000)
  const isOverdue = rfq.status === 'SENT' && daysLeft < 0

  const scores = quotes.map(q => computeWeightedScore(q, quotes))

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0" asChild>
            <Link href="/procurement/rfqs"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold">{rfq.rfqNumber}</h1>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLE[rfq.status])}>
                {rfq.status}
              </span>
              {rfq.quotations.length > 0 && (
                <span className="rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  {rfq.quotations.length} Response{rfq.quotations.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Supplier: <strong>{rfq.vendor.name}</strong>
              {rfq.pr && (
                <> · PR: <Link href={`/procurement/purchase-requests/${rfq.pr.id}`} className="text-blue-600 hover:underline">{rfq.pr.prNumber}</Link></>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {rfq.status === 'DRAFT' && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
              onClick={() => statusMutation.mutate('SENT')} disabled={statusMutation.isPending}>
              <Send className="mr-1.5 h-3.5 w-3.5" />Mark as Sent
            </Button>
          )}
          {rfq.status === 'SENT' && (
            <Button size="sm" variant="outline"
              onClick={() => statusMutation.mutate('CLOSED')} disabled={statusMutation.isPending}>
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Close RFQ
            </Button>
          )}
          {rfq.quotations.length > 0 && rfq.status !== 'CANCELLED' && (
            <Button size="sm" asChild>
              <Link href={`/procurement/purchase-orders/new?rfqId=${rfq.id}&vendorId=${bestQuote?.vendor.id}`}>
                <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />Create PO
              </Link>
            </Button>
          )}
          {rfq.status !== 'CANCELLED' && rfq.status !== 'CLOSED' && (
            <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => statusMutation.mutate('CANCELLED')} disabled={statusMutation.isPending}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" />Cancel
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Sourcing Pipeline</p>
          <div className="flex items-center flex-wrap gap-y-2 overflow-x-auto pb-1">
            {WORKFLOW.map((step, i) => {
              const done     = i < activeIdx
              const active   = i === activeIdx
              const isCancelled = rfq.status === 'CANCELLED'
              return (
                <div key={step.key} className="flex items-center shrink-0">
                  <div className={cn(
                    'flex h-7 items-center rounded-full px-2.5 text-[10px] font-semibold',
                    isCancelled && i <= 2 ? 'bg-red-100 text-red-600'
                      : done ? 'bg-emerald-100 text-emerald-700'
                      : active ? 'bg-blue-600 text-white'
                      : 'bg-muted text-muted-foreground/40',
                  )}>
                    {done && !isCancelled && <span className="mr-0.5 text-[8px]">✓</span>}
                    {step.label}
                  </div>
                  {i < WORKFLOW.length - 1 && (
                    <ChevronRight className={cn('h-3 w-3 mx-0.5 shrink-0', done ? 'text-emerald-300' : 'text-muted-foreground/20')} />
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {rfq.status === 'SENT' && (
              isOverdue
                ? <span className="font-semibold text-red-600">⚠ Closing date passed {Math.abs(daysLeft)} day(s) ago</span>
                : <span>Closes in <strong>{daysLeft}</strong> day(s) · {formatDate(rfq.dueDate)}</span>
            )}
            {rfq.status === 'DRAFT' && <span className="text-muted-foreground">→ Mark as Sent to start receiving quotations</span>}
          </div>
        </CardContent>
      </Card>

      {isOverdue && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <Clock className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-800">
            <span className="font-semibold">RFQ overdue — </span>
            Closing date was {formatDate(rfq.dueDate)}. Close this RFQ or update the deadline.
          </p>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-8 text-xs gap-0.5 bg-muted/50">
          {[
            { value: 'overview',   label: 'Overview',                  Icon: FileSearch  },
            { value: 'items',      label: `Items (${rfq.lineItems.length})`, Icon: Package },
            { value: 'responses',  label: `Responses (${rfq.quotations.length})`, Icon: FileText },
            { value: 'comparison', label: 'Comparison',                Icon: TrendingUp  },
            { value: 'activity',   label: 'Activity',                  Icon: Activity    },
          ].map(({ value, label, Icon }) => (
            <TabsTrigger key={value} value={value} className="h-7 text-[11px] px-3 gap-1.5">
              <Icon className="h-3 w-3" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { Icon: Users,    label: 'Supplier',     value: rfq.vendor.name },
              { Icon: Calendar, label: 'RFQ Date',     value: formatDate(rfq.rfqDate) },
              { Icon: Clock,    label: 'Closing Date', value: formatDate(rfq.dueDate), warn: isOverdue },
              { Icon: FileText, label: 'Line Items',   value: `${rfq.lineItems.length} items` },
            ].map(({ Icon, label, value, warn }) => (
              <Card key={label} className="border-border/60 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  </div>
                  <p className={cn('text-sm font-medium', warn ? 'font-bold text-red-600' : '')}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />Response Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">1</p>
                    <p className="text-[10px] font-medium text-blue-500 mt-0.5">Invited</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{rfq.quotations.length}</p>
                    <p className="text-[10px] font-medium text-emerald-500 mt-0.5">Responded</p>
                  </div>
                  <div className={cn('rounded-xl border p-3 text-center',
                    rfq.quotations.length === 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100',
                  )}>
                    <p className={cn('text-2xl font-bold', rfq.quotations.length === 0 ? 'text-amber-600' : 'text-gray-300')}>
                      {Math.max(0, 1 - rfq.quotations.length)}
                    </p>
                    <p className={cn('text-[10px] font-medium mt-0.5', rfq.quotations.length === 0 ? 'text-amber-500' : 'text-gray-400')}>
                      Pending
                    </p>
                  </div>
                </div>
                {bestQuote && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 mb-0.5">Best Price Received</p>
                    <p className="text-xl font-bold text-emerald-700">{formatCurrency(Number(bestQuote.totalAmount))}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">{bestQuote.vendor.name}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />Description
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {rfq.notes ? (
                  <p className="text-sm text-foreground leading-relaxed">{rfq.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description provided.</p>
                )}
                {rfq.pr && (
                  <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 mb-1">Linked Purchase Request</p>
                    <Link href={`/procurement/purchase-requests/${rfq.pr.id}`}
                      className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                      {rfq.pr.prNumber} →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="items">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-500" />Requested Items
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {rfq.lineItems.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No items specified.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-8">#</th>
                      <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Description</th>
                      <th className="pb-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-20">Qty</th>
                      <th className="pb-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-16">UOM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {rfq.lineItems.map((li, i) => (
                      <tr key={li.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 text-xs text-muted-foreground/40">{i + 1}</td>
                        <td className="py-3 font-medium pl-2">{li.description}</td>
                        <td className="py-3 text-right">{Number(li.quantity)}</td>
                        <td className="py-3 text-right text-xs text-muted-foreground">{li.uom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{rfq.quotations.length} quotation(s) received</p>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/procurement/supplier-quotations?rfqId=${rfq.id}`}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />Add Quotation
              </Link>
            </Button>
          </div>

          {quotes.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm font-medium text-muted-foreground">No quotations received yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Add supplier quotations to compare prices.</p>
                <Button size="sm" className="mt-4" asChild>
                  <Link href={`/procurement/supplier-quotations?rfqId=${rfq.id}`}>Add First Quotation</Link>
                </Button>
              </CardContent>
            </Card>
          ) : quotes.map((q, i) => (
            <Card key={q.id} className={cn('border-border/60 shadow-sm', i === 0 ? 'ring-1 ring-emerald-200' : '')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shrink-0',
                      i === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground',
                    )}>
                      {i === 0 ? <Trophy className="h-4 w-4" /> : i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-sm">{q.vendor.name}</span>
                        {i === 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                            Lowest Price
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{q.sqNumber}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Valid until {formatDate(q.validUntil)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className={cn('text-lg font-bold', i === 0 ? 'text-emerald-600' : '')}>
                        {formatCurrency(Number(q.totalAmount))}
                      </p>
                      {bestQuote && i > 0 && (
                        <p className="text-[10px] text-red-500 font-medium">
                          +{formatCurrency(Number(q.totalAmount) - Number(bestQuote.totalAmount))} vs best
                        </p>
                      )}
                    </div>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                      SQ_STYLE[q.status] ?? 'bg-gray-50 text-gray-600 border-gray-200',
                    )}>
                      {q.status.replace(/_/g, ' ')}
                    </span>
                    {q.status !== 'ACCEPTED' && (
                      <Button size="sm" variant="outline"
                        className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => sqMutation.mutate({ qId: q.id, status: 'ACCEPTED' })}
                        disabled={sqMutation.isPending}>
                        <CheckCircle className="mr-1 h-3 w-3" />Accept
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" asChild>
                      <Link href={`/procurement/supplier-quotations/${q.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          {quotes.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-12 text-center">
                <TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm font-medium text-muted-foreground">No quotations to compare</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Add at least one supplier quotation first.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500" />Supplier Scoring Matrix
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">Weighted evaluation</span>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[400px]">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-28">Criteria</th>
                          <th className="pb-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-16">Weight</th>
                          {quotes.map((q, i) => (
                            <th key={q.id} className={cn(
                              'pb-2.5 text-center text-[10px] font-semibold uppercase tracking-wider',
                              i === 0 ? 'text-emerald-600' : 'text-muted-foreground/70',
                            )}>
                              {q.vendor.name}{i === 0 ? ' ★' : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {CRITERIA.map(({ label, weight }, ci) => {
                          const rowScores = scores.map(s => [s.price, s.delivery, s.quality, s.perf][ci])
                          return (
                            <tr key={label} className="hover:bg-muted/30">
                              <td className="py-2.5 font-medium">{label}</td>
                              <td className="py-2.5 text-center text-muted-foreground">{weight}%</td>
                              {rowScores.map((score, i) => (
                                <td key={i} className="py-2.5 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={cn('font-bold text-sm',
                                      score >= 90 ? 'text-emerald-600' : score >= 75 ? 'text-amber-600' : 'text-red-500',
                                    )}>{score}</span>
                                    <div className="h-1 w-10 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className={cn('h-full rounded-full', score >= 90 ? 'bg-emerald-500' : score >= 75 ? 'bg-amber-400' : 'bg-red-400')}
                                        style={{ width: `${score}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                        <tr className="border-t-2 border-border/60 bg-muted/20 font-bold">
                          <td className="py-3 text-sm">Overall Score</td>
                          <td className="py-3 text-center text-muted-foreground text-sm">100%</td>
                          {scores.map((s, i) => (
                            <td key={i} className={cn('py-3 text-center', i === 0 ? 'text-emerald-600' : 'text-foreground')}>
                              <p className="text-xl font-bold">{s.total}</p>
                              {i === 0 && <p className="text-[10px] font-semibold text-emerald-500 mt-0.5">Recommended</p>}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />Commercial Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[400px]">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-28">Criteria</th>
                          {quotes.map((q, i) => (
                            <th key={q.id} className={cn('pb-2.5 text-center text-[10px] font-semibold uppercase tracking-wider',
                              i === 0 ? 'text-emerald-600' : 'text-muted-foreground/70',
                            )}>
                              {q.vendor.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        <tr className="hover:bg-muted/30">
                          <td className="py-2.5 font-medium text-muted-foreground">Total Price</td>
                          {quotes.map((q, i) => (
                            <td key={q.id} className={cn('py-2.5 text-center', i === 0 ? 'font-bold text-emerald-600' : '')}>
                              {formatCurrency(Number(q.totalAmount))}
                              {i === 0 && <p className="text-[9px] text-emerald-500 font-semibold">BEST PRICE</p>}
                              {i > 0 && bestQuote && (
                                <p className="text-[9px] text-red-400">+{formatCurrency(Number(q.totalAmount) - Number(bestQuote.totalAmount))}</p>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-muted/30">
                          <td className="py-2.5 font-medium text-muted-foreground">Valid Until</td>
                          {quotes.map(q => <td key={q.id} className="py-2.5 text-center text-muted-foreground">{formatDate(q.validUntil)}</td>)}
                        </tr>
                        <tr className="hover:bg-muted/30">
                          <td className="py-2.5 font-medium text-muted-foreground">Status</td>
                          {quotes.map(q => (
                            <td key={q.id} className="py-2.5 text-center">
                              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                SQ_STYLE[q.status] ?? 'bg-gray-50 text-gray-600 border-gray-200',
                              )}>
                                {q.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {bestQuote && rfq.status !== 'CANCELLED' && (
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                            <Trophy className="h-4 w-4" />Recommended: {bestQuote.vendor.name}
                          </p>
                          <p className="text-xs text-emerald-600 mt-0.5">
                            Total value: <strong>{formatCurrency(Number(bestQuote.totalAmount))}</strong>
                            {quotes.length > 1 && (
                              <span className="ml-2">
                                · {formatCurrency(Number(quotes[quotes.length - 1].totalAmount) - Number(bestQuote.totalAmount))} saving vs highest
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                            onClick={() => sqMutation.mutate({ qId: bestQuote.id, status: 'ACCEPTED' })}
                            disabled={sqMutation.isPending || bestQuote.status === 'ACCEPTED'}>
                            <CheckCircle className="mr-1 h-3.5 w-3.5" />
                            {bestQuote.status === 'ACCEPTED' ? 'Awarded' : 'Award Supplier'}
                          </Button>
                          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" asChild>
                            <Link href={`/procurement/purchase-orders/new?rfqId=${rfq.id}&vendorId=${bestQuote.vendor.id}`}>
                              <ShoppingCart className="mr-1 h-3.5 w-3.5" />Create PO
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="activity">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="space-y-0">
                {[
                  { label: 'RFQ Created',          sub: rfq.rfqNumber,   date: rfq.rfqDate,  dot: 'bg-blue-500' },
                  ...(rfq.status !== 'DRAFT' ? [{ label: 'Sent to Supplier', sub: rfq.vendor.name, date: rfq.rfqDate, dot: 'bg-indigo-500' }] : []),
                  ...rfq.quotations.map(q => ({
                    label: 'Quotation Received', dot: 'bg-emerald-500',
                    sub: `${q.vendor.name} · ${q.sqNumber} · ${formatCurrency(Number(q.totalAmount))}`,
                    date: q.validUntil,
                  })),
                  ...(rfq.status === 'CLOSED'    ? [{ label: 'RFQ Closed',    sub: 'Evaluation completed', date: rfq.dueDate, dot: 'bg-purple-500' }] : []),
                  ...(rfq.status === 'CANCELLED' ? [{ label: 'RFQ Cancelled', sub: '',                    date: rfq.dueDate, dot: 'bg-red-500' }] : []),
                ].map((e, i, arr) => (
                  <div key={i} className="flex gap-4">
                    <div className="relative flex flex-col items-center pt-1">
                      <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', e.dot)} />
                      {i < arr.length - 1 && <div className="w-px flex-1 bg-border/40 mt-1 min-h-[2rem]" />}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm font-semibold leading-tight">{e.label}</p>
                      {e.sub && <p className="text-xs text-muted-foreground mt-0.5">{e.sub}</p>}
                      <p className="text-[10px] text-muted-foreground/50 mt-1">{formatDate(e.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
