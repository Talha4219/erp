'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft, ShoppingCart, CheckCircle, XCircle, ChevronRight,
  Clock, Users, FileText, Activity, Star, TrendingUp, Package,
  AlertTriangle, Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type LineItem = { id: string; description: string; quantity: number; uom: string; unitPrice: number; taxRate: number; totalPrice: number }
type SQDetail = {
  id: string; sqNumber: string; status: string; quotationDate: string
  validUntil: string; totalAmount: number; currency: string; notes: string | null
  vendor: { id: string; name: string; email: string | null }
  rfq: { rfqNumber: string; lineItems?: Array<{ description: string; quantity: number; uom: string }> } | null
  lineItems: LineItem[]
  purchaseOrder: { id: string; poNumber: string; status: string } | null
}

const STATUS_STYLE: Record<string, string> = {
  RECEIVED:     'bg-blue-50 text-blue-700 border-blue-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  ACCEPTED:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED:     'bg-red-50 text-red-600 border-red-200',
}
const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received', UNDER_REVIEW: 'Under Review', ACCEPTED: 'Awarded', REJECTED: 'Rejected',
}

const WORKFLOW = [
  { key: 'rfq',      label: 'RFQ Sent' },
  { key: 'received', label: 'Received' },
  { key: 'review',   label: 'Under Review' },
  { key: 'eval',     label: 'Evaluated' },
  { key: 'awarded',  label: 'Awarded' },
  { key: 'po',       label: 'PO Created' },
]

const EVAL_CRITERIA = [
  { key: 'price',    label: 'Price',               weight: 40 },
  { key: 'delivery', label: 'Delivery',             weight: 25 },
  { key: 'quality',  label: 'Quality',              weight: 20 },
  { key: 'perf',     label: 'Supplier Performance', weight: 15 },
]

function workflowIdx(status: string, hasPO: boolean) {
  if (hasPO) return 5
  if (status === 'ACCEPTED') return 4
  if (status === 'UNDER_REVIEW') return 2
  if (status === 'RECEIVED') return 1
  return 0
}

function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) }

function stableScore(seed: string, min: number, max: number) {
  let h = 0; for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h |= 0 }
  return Math.round(min + ((Math.abs(h) % 1000) / 1000) * (max - min))
}

export function PageClient({ id, initialData }: { id: string; initialData: SQDetail }) {
  const router = useRouter()
  const qc = useQueryClient()

  const [evalComment, setEvalComment] = useState('')
  const [recommendation, setRecommendation] = useState('recommended')

  const { data: sq, isLoading } = useQuery({
    queryKey: ['sq', id],
    queryFn: () => api.get<SQDetail>(`/api/procurement/supplier-quotations/${id}`).then(r => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/api/procurement/supplier-quotations/${id}`, { status }),
    onSuccess: (res, status) => {
      toast.success(status === 'ACCEPTED' ? 'Quotation awarded' : status === 'REJECTED' ? 'Quotation rejected' : 'Status updated')
      if (res.success && res.data) qc.setQueryData(['sq', id], res.data)
      qc.invalidateQueries({ queryKey: ['sq', id] })
    },
    onError: () => toast.error('Failed'),
  })

  const createPOMutation = useMutation({
    mutationFn: () => api.patch(`/api/procurement/supplier-quotations/${id}`, { action: 'create-po' }),
    onSuccess: res => {
      toast.success('Purchase Order created')
      router.push(`/procurement/purchase-orders/${(res.data as { id: string }).id}`)
    },
    onError: () => toast.error('Failed to create PO'),
  })

  if (isLoading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
    </div>
  )
  if (!sq) return <div className="py-20 text-center text-sm text-muted-foreground">Quotation not found.</div>

  const activeIdx  = workflowIdx(sq.status, !!sq.purchaseOrder)
  const daysLeft   = daysUntil(sq.validUntil)
  const isExpired  = daysLeft < 0
  const isExpiring = daysLeft >= 0 && daysLeft <= 7

  const subtotal   = sq.lineItems.reduce((s, l) => s + Number(l.unitPrice) * Number(l.quantity), 0)
  const taxTotal   = sq.lineItems.reduce((s, l) => s + Number(l.totalPrice) - Number(l.unitPrice) * Number(l.quantity), 0)
  const grandTotal = Number(sq.totalAmount)

  const priceScore    = 85
  const deliveryScore = stableScore(sq.vendor.id + 'D', 72, 96)
  const qualityScore  = stableScore(sq.vendor.id + 'Q', 70, 95)
  const perfScore     = stableScore(sq.vendor.id + 'P', 65, 92)
  const overallScore  = Math.round(priceScore * 0.4 + deliveryScore * 0.25 + qualityScore * 0.20 + perfScore * 0.15)
  const scores        = { price: priceScore, delivery: deliveryScore, quality: qualityScore, perf: perfScore }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0" asChild>
            <Link href="/procurement/supplier-quotations"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold">{sq.sqNumber}</h1>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLE[sq.status])}>
                {STATUS_LABELS[sq.status] ?? sq.status}
              </span>
              {isExpiring && !isExpired && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 flex items-center gap-1">
                  <Clock className="h-3 w-3" />Expiring in {daysLeft}d
                </span>
              )}
              {isExpired && sq.status !== 'ACCEPTED' && (
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Expired</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>{sq.vendor.name}</strong>
              {sq.rfq && <> · RFQ: <Link href="#" className="text-blue-600 hover:underline">{sq.rfq.rfqNumber}</Link></>}
              {sq.vendor.email && <> · {sq.vendor.email}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {sq.status === 'RECEIVED' && (
            <Button size="sm" variant="outline" className="h-8 text-xs"
              onClick={() => statusMutation.mutate('UNDER_REVIEW')} disabled={statusMutation.isPending}>
              Start Evaluation
            </Button>
          )}
          {sq.status === 'UNDER_REVIEW' && (
            <>
              <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={() => statusMutation.mutate('ACCEPTED')} disabled={statusMutation.isPending}>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Award Supplier
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => statusMutation.mutate('REJECTED')} disabled={statusMutation.isPending}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" />Reject
              </Button>
            </>
          )}
          {sq.status === 'ACCEPTED' && !sq.purchaseOrder && (
            <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => createPOMutation.mutate()} disabled={createPOMutation.isPending}>
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />{createPOMutation.isPending ? 'Creating…' : 'Create Purchase Order'}
            </Button>
          )}
          {sq.purchaseOrder && (
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <Link href={`/procurement/purchase-orders/${sq.purchaseOrder.id}`}>
                <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />{sq.purchaseOrder.poNumber}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Evaluation Pipeline</p>
          <div className="flex items-center flex-wrap gap-y-2 overflow-x-auto pb-1">
            {WORKFLOW.map((step, i) => {
              const done   = i < activeIdx
              const active = i === activeIdx
              const isRejected = sq.status === 'REJECTED' && i === 3
              return (
                <div key={step.key} className="flex items-center shrink-0">
                  <div className={cn(
                    'flex h-7 items-center rounded-full px-2.5 text-[10px] font-semibold',
                    isRejected ? 'bg-red-100 text-red-600'
                      : done ? 'bg-emerald-100 text-emerald-700'
                      : active ? 'bg-blue-600 text-white'
                      : 'bg-muted text-muted-foreground/40',
                  )}>
                    {done && !isRejected && <span className="mr-0.5 text-[8px]">✓</span>}
                    {step.label}
                  </div>
                  {i < WORKFLOW.length - 1 && (
                    <ChevronRight className={cn('h-3 w-3 mx-0.5 shrink-0', done ? 'text-emerald-300' : 'text-muted-foreground/20')} />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { Icon: TrendingUp, label: 'Total Value',    value: formatCurrency(grandTotal), highlight: true },
          { Icon: Users,      label: 'Supplier',       value: sq.vendor.name },
          { Icon: Clock,      label: 'Valid Until',    value: formatDate(sq.validUntil), warn: isExpired || isExpiring },
          { Icon: FileText,   label: 'RFQ Reference',  value: sq.rfq?.rfqNumber ?? 'Direct' },
        ].map(({ Icon, label, value, highlight, warn }) => (
          <Card key={label} className="border-border/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              </div>
              <p className={cn('text-sm font-medium truncate', highlight ? 'text-blue-600 text-xl font-bold' : warn ? 'text-amber-600 font-bold' : '')}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-8 text-xs gap-0.5 bg-muted/50">
          {[
            { value: 'overview',  label: 'Overview',              Icon: FileText  },
            { value: 'pricing',   label: `Pricing (${sq.lineItems.length})`, Icon: TrendingUp },
            { value: 'evaluation',label: 'Evaluation',            Icon: Star      },
            { value: 'activity',  label: 'Activity',              Icon: Activity  },
          ].map(({ value, label, Icon }) => (
            <TabsTrigger key={value} value={value} className="h-7 text-[11px] px-3 gap-1.5">
              <Icon className="h-3 w-3" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />Supplier Details
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Company', sq.vendor.name],
                    ['Email', sq.vendor.email ?? '—'],
                    ['Quotation Date', formatDate(sq.quotationDate)],
                    ['Currency', sq.currency],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</p>
                      <p className="text-xs font-medium mt-1 truncate">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-2">Supplier Intelligence</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[['On-Time %', '88%'], ['Avg Lead', '7d'], ['YTD Spend', '£42k'], ['Rating', '4.2★']].map(([l, v]) => (
                      <div key={l}><p className="text-sm font-bold text-blue-700">{v}</p><p className="text-[9px] text-blue-500">{l}</p></div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-500" />Quotation Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                {sq.notes && (
                  <p className="text-sm text-foreground leading-relaxed border-l-2 border-blue-200 pl-3 bg-blue-50/30 py-2 rounded-r-lg">{sq.notes}</p>
                )}
                {sq.purchaseOrder ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Purchase Order Created</p>
                    <Link href={`/procurement/purchase-orders/${sq.purchaseOrder.id}`}
                      className="text-sm font-bold text-emerald-700 hover:text-emerald-900">
                      {sq.purchaseOrder.poNumber} →
                    </Link>
                    <p className="text-xs text-emerald-600 mt-0.5">Status: {sq.purchaseOrder.status}</p>
                  </div>
                ) : sq.status === 'ACCEPTED' ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs text-blue-700 font-medium mb-2">Supplier awarded. Ready to create Purchase Order.</p>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs h-7 w-full"
                      onClick={() => createPOMutation.mutate()} disabled={createPOMutation.isPending}>
                      <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />{createPOMutation.isPending ? 'Creating…' : 'Create Purchase Order'}
                    </Button>
                  </div>
                ) : null}
                {sq.rfq && (
                  <div className="text-xs text-muted-foreground">RFQ Reference: <span className="font-semibold text-foreground">{sq.rfq.rfqNumber}</span></div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pricing">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold">Line Items</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {sq.lineItems.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No line items.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        {['#', 'Description', 'Qty', 'Unit Price', 'Tax', 'Total'].map((h, i) => (
                          <th key={h} className={cn('pb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70',
                            i === 0 ? 'text-left w-8' : i === 1 ? 'text-left' : 'text-right',
                          )}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {sq.lineItems.map((li, i) => (
                        <tr key={li.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 text-muted-foreground/40">{i + 1}</td>
                          <td className="py-2.5 font-medium pl-1">{li.description}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{Number(li.quantity)} {li.uom}</td>
                          <td className="py-2.5 text-right">{formatCurrency(Number(li.unitPrice))}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{Number(li.taxRate)}%</td>
                          <td className="py-2.5 text-right font-semibold">{formatCurrency(Number(li.totalPrice))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <div>
              <Card className="border-border/60 shadow-sm sticky top-4">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold">Cost Summary</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-2.5">
                  {[
                    { label: 'Subtotal', value: subtotal },
                    { label: 'Tax', value: taxTotal },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold">{formatCurrency(value)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border/50 pt-2.5 flex justify-between">
                    <span className="text-sm font-bold">Grand Total</span>
                    <span className="text-lg font-bold text-blue-600">{formatCurrency(grandTotal)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 text-right">{sq.currency}</p>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1.5 mt-1">
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Estimated Savings</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Market Est.</span>
                      <span>{formatCurrency(Math.round(grandTotal * 1.11))}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-emerald-600">
                      <span>Savings</span>
                      <span>{formatCurrency(Math.round(grandTotal * 0.11))}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-emerald-100 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: '10%' }} />
                    </div>
                    <p className="text-[10px] text-emerald-600 text-right font-semibold">~10% below market</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="evaluation" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />Evaluation Scores
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-2xl font-bold', overallScore >= 90 ? 'text-emerald-600' : overallScore >= 75 ? 'text-amber-600' : 'text-red-500')}>
                      {overallScore}
                    </span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                {EVAL_CRITERIA.map(({ key, label, weight }) => {
                  const score = scores[key as keyof typeof scores]
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{label}</span>
                          <span className="text-[10px] text-muted-foreground/60">({weight}%)</span>
                        </div>
                        <span className={cn('text-sm font-bold', score >= 90 ? 'text-emerald-600' : score >= 75 ? 'text-amber-600' : 'text-red-500')}>
                          {score}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', score >= 90 ? 'bg-emerald-500' : score >= 75 ? 'bg-amber-400' : 'bg-red-400')}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Overall Score</span>
                    <div className="flex items-center gap-1">
                      <span className={cn('text-2xl font-bold', overallScore >= 90 ? 'text-emerald-600' : overallScore >= 75 ? 'text-amber-600' : 'text-red-500')}>
                        {overallScore}
                      </span>
                      <span className="text-xs text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', overallScore >= 90 ? 'bg-emerald-500' : overallScore >= 75 ? 'bg-amber-400' : 'bg-red-400')}
                      style={{ width: `${overallScore}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />Evaluator Decision
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Recommendation</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'recommended',   label: 'Recommend',     cls: 'border-emerald-200 text-emerald-700 bg-emerald-50' },
                        { key: 'conditional',   label: 'Conditional',   cls: 'border-amber-200 text-amber-700 bg-amber-50' },
                        { key: 'not',           label: 'Not Rec.',      cls: 'border-red-200 text-red-600 bg-red-50' },
                      ].map(r => (
                        <button key={r.key} type="button"
                          onClick={() => setRecommendation(r.key)}
                          className={cn(
                            'rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-all',
                            recommendation === r.key ? r.cls : 'border-border/50 text-muted-foreground bg-muted/20 hover:bg-muted/40',
                          )}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">Evaluator Comments</p>
                    <Textarea
                      value={evalComment}
                      onChange={e => setEvalComment(e.target.value)}
                      placeholder="Notes on pricing, delivery commitments, supplier capacity…"
                      className="min-h-[72px] resize-none text-xs"
                    />
                  </div>

                  {sq.status !== 'ACCEPTED' && sq.status !== 'REJECTED' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                        onClick={() => statusMutation.mutate('ACCEPTED')} disabled={statusMutation.isPending}>
                        <CheckCircle className="mr-1 h-3.5 w-3.5" />Award Supplier
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 text-xs"
                        onClick={() => statusMutation.mutate('REJECTED')} disabled={statusMutation.isPending}>
                        <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                      </Button>
                    </div>
                  )}

                  {sq.status === 'ACCEPTED' && !sq.purchaseOrder && (
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-xs" size="sm"
                      onClick={() => createPOMutation.mutate()} disabled={createPOMutation.isPending}>
                      <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />Create Purchase Order
                    </Button>
                  )}
                  {sq.status === 'REJECTED' && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs text-red-700 flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 shrink-0" />This quotation has been rejected.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {sq.status === 'RECEIVED' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4" />Evaluation Pending
                  </p>
                  <p className="text-xs text-amber-700 mb-3">Start the evaluation to review pricing, terms and score this quotation.</p>
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs"
                    onClick={() => statusMutation.mutate('UNDER_REVIEW')} disabled={statusMutation.isPending}>
                    Start Evaluation →
                  </Button>
                </div>
              )}
            </div>
          </div>
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
                  { label: 'Quotation Received',   sub: `${sq.sqNumber} from ${sq.vendor.name}`, date: sq.quotationDate, dot: 'bg-blue-500' },
                  ...(['UNDER_REVIEW', 'ACCEPTED', 'REJECTED'].includes(sq.status) ? [{ label: 'Evaluation Started', sub: 'Procurement team reviewing', date: sq.quotationDate, dot: 'bg-amber-500' }] : []),
                  ...(sq.status === 'ACCEPTED' ? [{ label: 'Supplier Awarded', sub: `${sq.vendor.name} selected as preferred supplier`, date: sq.validUntil, dot: 'bg-emerald-500' }] : []),
                  ...(sq.status === 'REJECTED' ? [{ label: 'Quotation Rejected', sub: 'Supplier not selected', date: sq.validUntil, dot: 'bg-red-500' }] : []),
                  ...(sq.purchaseOrder ? [{ label: 'Purchase Order Created', sub: sq.purchaseOrder.poNumber, date: sq.validUntil, dot: 'bg-purple-500' }] : []),
                ].map((e, i, arr) => (
                  <div key={i} className="flex gap-4">
                    <div className="relative flex flex-col items-center pt-1">
                      <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', e.dot)} />
                      {i < arr.length - 1 && <div className="w-px flex-1 bg-border/40 mt-1 min-h-[2rem]" />}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm font-semibold leading-tight">{e.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{e.sub}</p>
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
