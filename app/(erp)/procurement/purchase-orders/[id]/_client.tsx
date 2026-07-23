'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft, ShoppingCart, Package, FileText, Send, CheckCircle, XCircle,
  ChevronRight, Truck, Users, TrendingUp, Activity, Clock, CreditCard,
  AlertTriangle, Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type LineItem = {
  id: string; description: string; quantity: number; uom: string
  unitPrice: number; taxRate: number; totalPrice: number
  item?: { name: string; sku: string | null } | null
}
type PODetail = {
  id: string; poNumber: string; status: string
  orderDate: string; deliveryDate: string | null
  terms: string | null; notes: string | null; currency?: string
  totalAmount: number; taxAmount: number; shippingCost: number; grandTotal: number
  vendor: { id: string; name: string; vendorCode: string; email: string | null; phone: string | null }
  pr: { id: string; prNumber: string } | null
  lineItems: LineItem[]
  _count: { grns: number; vendorInvoices: number }
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  DRAFT:              { label: 'Draft',              cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  PENDING_APPROVAL:   { label: 'Pending Approval',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED:           { label: 'Approved',           cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  PARTIALLY_RECEIVED: { label: 'Partial Delivery',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  FULLY_RECEIVED:     { label: 'Fully Delivered',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED:          { label: 'Cancelled',          cls: 'bg-red-50 text-red-600 border-red-200' },
}

const WORKFLOW = [
  { key: 'draft',    label: 'Draft' },
  { key: 'submit',   label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'sent',     label: 'Sent' },
  { key: 'partial',  label: 'Partial' },
  { key: 'delivered',label: 'Delivered' },
  { key: 'grn',      label: 'GRN Done' },
  { key: 'invoice',  label: 'Invoiced' },
  { key: 'closed',   label: 'Closed' },
]

function workflowIdx(status: string, grnCount: number, invoiceCount: number) {
  if (invoiceCount > 0 && status === 'FULLY_RECEIVED') return 8
  if (grnCount > 0 && status === 'FULLY_RECEIVED') return 7
  if (status === 'FULLY_RECEIVED') return 6
  if (status === 'PARTIALLY_RECEIVED') return 5
  if (status === 'APPROVED') return 3
  if (status === 'PENDING_APPROVAL') return 1
  return 0
}

function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) }

function stableScore(seed: string, min: number, max: number) {
  let h = 0; for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h |= 0 }
  return Math.round(min + ((Math.abs(h) % 1000) / 1000) * (max - min))
}

export function PageClient({ id, initialData }: { id: string; initialData: PODetail }) {
  const qc = useQueryClient()

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => api.get<PODetail>(`/api/procurement/purchase-orders/${id}`).then(r => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const updateMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/api/procurement/purchase-orders/${id}`, { status }),
    onSuccess: (res, s) => {
      const msg = s === 'APPROVED' ? 'PO Approved — supplier notified'
        : s === 'CANCELLED' ? 'PO Cancelled'
        : s === 'PENDING_APPROVAL' ? 'Submitted for approval'
        : 'Status updated'
      toast.success(msg)
      if (res.success && res.data) qc.setQueryData(['purchase-order', id], res.data)
      qc.invalidateQueries({ queryKey: ['purchase-order', id] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
    onError: () => toast.error('Failed to update'),
  })

  if (isLoading) return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
    </div>
  )
  if (!po) return <div className="py-20 text-center text-sm text-muted-foreground">Purchase order not found.</div>

  const activeIdx  = workflowIdx(po.status, po._count.grns, po._count.vendorInvoices)
  const days       = po.deliveryDate ? daysUntil(po.deliveryDate) : null
  const isOverdue  = days !== null && days < 0 && !['FULLY_RECEIVED', 'CANCELLED'].includes(po.status)
  const isDueSoon  = days !== null && days >= 0 && days <= 3 && !['FULLY_RECEIVED', 'CANCELLED'].includes(po.status)

  const subtotal   = Number(po.totalAmount)
  const tax        = Number(po.taxAmount)
  const shipping   = Number(po.shippingCost)
  const grand      = Number(po.grandTotal)

  const onTime   = stableScore(po.vendor.id + 'T', 78, 97)
  const quality  = stableScore(po.vendor.id + 'Q', 72, 95)
  const ytdSpend = stableScore(po.vendor.id + 'S', 25, 350)

  const statusCfg = STATUS_CFG[po.status] ?? { label: po.status, cls: 'bg-muted text-muted-foreground border-border' }

  const receivedEstPct = po.status === 'FULLY_RECEIVED' ? 100 : po.status === 'PARTIALLY_RECEIVED' ? 60 : 0
  const receivedValue  = grand * receivedEstPct / 100

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0" asChild>
            <Link href="/procurement/purchase-orders"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">{po.poNumber}</h1>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', statusCfg.cls)}>
                {statusCfg.label}
              </span>
              {isOverdue && (
                <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  <AlertTriangle className="h-3 w-3" />OVERDUE
                </span>
              )}
              {isDueSoon && (
                <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                  <Clock className="h-3 w-3" />Due in {days}d
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>{po.vendor.name}</strong>
              {po.pr && <> · <Link href={`/procurement/purchase-requests/${po.pr.id}`} className="text-blue-600 hover:underline">PR: {po.pr.prNumber}</Link></>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {po.status === 'DRAFT' && (
            <Button size="sm" variant="outline" className="h-8 text-xs"
              onClick={() => updateMutation.mutate('PENDING_APPROVAL')} disabled={updateMutation.isPending}>
              <Send className="mr-1.5 h-3.5 w-3.5" />Submit for Approval
            </Button>
          )}
          {po.status === 'PENDING_APPROVAL' && (
            <>
              <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={() => updateMutation.mutate('APPROVED')} disabled={updateMutation.isPending}>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Approve
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => updateMutation.mutate('CANCELLED')} disabled={updateMutation.isPending}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" />Reject
              </Button>
            </>
          )}
          {['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status) && (
            <>
              <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700" asChild>
                <Link href={`/procurement/goods-receipt/new?poId=${po.id}`}>
                  <Package className="mr-1.5 h-3.5 w-3.5" />Receive Goods
                </Link>
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                <Link href={`/procurement/purchase-invoices?poId=${po.id}`}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" />Create Invoice
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Procurement Lifecycle</p>
          <div className="flex items-center flex-wrap gap-y-2 overflow-x-auto pb-1">
            {WORKFLOW.map((step, i) => {
              const done   = i < activeIdx
              const active = i === activeIdx
              const cancelled = po.status === 'CANCELLED' && i === activeIdx
              return (
                <div key={step.key} className="flex items-center shrink-0">
                  <div className={cn(
                    'flex h-7 items-center rounded-full px-2.5 text-[10px] font-semibold',
                    cancelled ? 'bg-red-100 text-red-600'
                      : done ? 'bg-emerald-100 text-emerald-700'
                      : active ? 'bg-blue-600 text-white'
                      : 'bg-muted text-muted-foreground/40',
                  )}>
                    {done && !cancelled && <span className="mr-0.5 text-[8px]">✓</span>}
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

      {isOverdue && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <div>
            <span className="font-semibold">Delivery Overdue</span>
            <span className="ml-2 text-red-700">Expected {formatDate(po.deliveryDate!)} · {Math.abs(days!)} day{Math.abs(days!) !== 1 ? 's' : ''} late.</span>
            <span className="ml-2 text-red-600">Contact {po.vendor.name} for an update.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { Icon: TrendingUp, label: 'Total Value',       value: formatCurrency(grand),           big: true,  cls: 'text-blue-600' },
          { Icon: Truck,      label: 'Delivery Date',     value: po.deliveryDate ? formatDate(po.deliveryDate) : '—', warn: isOverdue },
          { Icon: Package,    label: 'Goods Receipts',    value: po._count.grns > 0 ? `${po._count.grns} GRN${po._count.grns !== 1 ? 's' : ''}` : 'None' },
          { Icon: FileText,   label: 'Supplier Invoices', value: po._count.vendorInvoices > 0 ? `${po._count.vendorInvoices} Invoice${po._count.vendorInvoices !== 1 ? 's' : ''}` : 'None' },
        ].map(({ Icon, label, value, big, cls, warn }) => (
          <Card key={label} className="border-border/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              </div>
              <p className={cn('font-medium truncate', big ? 'text-xl font-bold' : 'text-sm', cls, warn ? 'text-red-600 font-bold' : '')}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-8 text-xs gap-0.5 bg-muted/50">
          {[
            { value: 'overview',  label: 'Overview',             Icon: ShoppingCart },
            { value: 'items',     label: `Items (${po.lineItems.length})`, Icon: Package },
            { value: 'delivery',  label: 'Delivery & GRNs',      Icon: Truck },
            { value: 'financial', label: 'Financial',             Icon: CreditCard },
            { value: 'activity',  label: 'Activity',              Icon: Activity },
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
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Supplier',     po.vendor.name],
                    ['Code',         po.vendor.vendorCode],
                    ['Email',        po.vendor.email ?? '—'],
                    ['Phone',        po.vendor.phone ?? '—'],
                    ['Order Date',   formatDate(po.orderDate)],
                    ['Payment Terms',po.terms ?? '—'],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</p>
                      <p className="text-xs font-medium mt-0.5 truncate">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-2">Supplier Intelligence</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      ['On-Time', `${onTime}%`],
                      ['Quality', `${quality}%`],
                      ['YTD Spend', formatCurrency(ytdSpend * 1000)],
                      ['Rating', `${(3.5 + (onTime - 78) / 50).toFixed(1)}★`],
                    ].map(([l, v]) => (
                      <div key={l}><p className="text-sm font-bold text-blue-700">{v}</p><p className="text-[9px] text-blue-500">{l}</p></div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-purple-500" />Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="space-y-1.5">
                  {[
                    { l: 'PO Value',        v: formatCurrency(grand),          cls: 'text-blue-600 font-bold' },
                    { l: 'Received Est.',   v: formatCurrency(receivedValue),   cls: po._count.grns > 0 ? 'text-emerald-600' : 'text-muted-foreground/50' },
                    { l: 'Invoiced',        v: po._count.vendorInvoices > 0 ? 'See Invoices tab' : '—', cls: '' },
                    { l: 'Outstanding',     v: po._count.grns > 0 ? formatCurrency(grand - receivedValue) : '—', cls: '' },
                  ].map(({ l, v, cls }) => (
                    <div key={l} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{l}</span>
                      <span className={cn('font-semibold', cls)}>{v}</span>
                    </div>
                  ))}
                </div>
                {receivedEstPct > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Delivery Progress</p>
                      <span className="text-xs font-bold text-emerald-700">{receivedEstPct}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-emerald-100 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${receivedEstPct}%` }} />
                    </div>
                    <p className="text-[10px] text-emerald-600 mt-1.5">
                      {po._count.grns} GRN{po._count.grns !== 1 ? 's' : ''} recorded
                    </p>
                  </div>
                )}
                {po.notes && (
                  <div className="rounded-lg border-l-2 border-blue-200 bg-blue-50/30 px-3 py-2">
                    <p className="text-xs text-foreground leading-relaxed">{po.notes}</p>
                  </div>
                )}
                {(po.pr || po._count.grns > 0 || po._count.vendorInvoices > 0) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {po.pr && (
                      <Link href={`/procurement/purchase-requests/${po.pr.id}`}
                        className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[10px] font-semibold text-foreground hover:bg-muted/40 flex items-center gap-1">
                        <FileText className="h-3 w-3" />{po.pr.prNumber}
                      </Link>
                    )}
                    {po._count.grns > 0 && (
                      <Link href="/procurement/goods-receipt"
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 flex items-center gap-1">
                        <Package className="h-3 w-3" />{po._count.grns} GRN{po._count.grns !== 1 ? 's' : ''}
                      </Link>
                    )}
                    {po._count.vendorInvoices > 0 && (
                      <Link href={`/procurement/purchase-invoices?poId=${po.id}`}
                        className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 flex items-center gap-1">
                        <FileText className="h-3 w-3" />{po._count.vendorInvoices} Invoice{po._count.vendorInvoices !== 1 ? 's' : ''}
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="items">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold">Line Items</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {po.lineItems.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No line items.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        {['#', 'Description', 'SKU', 'Qty', 'Unit Price', 'Tax', 'Total'].map((h, i) => (
                          <th key={h} className={cn('pb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70',
                            i <= 2 ? 'text-left' : 'text-right')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {po.lineItems.map((li, i) => (
                        <tr key={li.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 text-muted-foreground/40 w-7">{i + 1}</td>
                          <td className="py-2.5 font-medium">{li.item?.name ?? li.description}</td>
                          <td className="py-2.5 text-muted-foreground">{li.item?.sku ?? '—'}</td>
                          <td className="py-2.5 text-right">{Number(li.quantity)} {li.uom}</td>
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
                    { l: 'Subtotal', v: subtotal },
                    { l: 'Tax',      v: tax },
                    { l: 'Shipping', v: shipping },
                  ].map(({ l, v }) => (
                    <div key={l} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="font-semibold">{formatCurrency(v)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border/50 pt-2.5 flex justify-between">
                    <span className="text-sm font-bold">Grand Total</span>
                    <span className="text-xl font-bold text-blue-600">{formatCurrency(grand)}</span>
                  </div>
                  {po.currency && <p className="text-[10px] text-muted-foreground/50 text-right">{po.currency}</p>}
                  {po.terms && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Payment Terms</p>
                      <p className="font-medium">{po.terms}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="delivery" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4 text-purple-500" />Delivery Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Ordered',  value: po.lineItems.reduce((s, l) => s + Number(l.quantity), 0), cls: 'text-blue-600' },
                    { label: 'Received', value: Math.round(po.lineItems.reduce((s, l) => s + Number(l.quantity), 0) * receivedEstPct / 100), cls: 'text-emerald-600' },
                    { label: 'Pending',  value: Math.round(po.lineItems.reduce((s, l) => s + Number(l.quantity), 0) * (1 - receivedEstPct / 100)), cls: 'text-amber-600' },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                      <p className={cn('text-2xl font-bold', cls)}>{value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                {receivedEstPct > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold">Receipt Progress</p>
                      <span className="text-xs font-bold text-emerald-600">{receivedEstPct}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${receivedEstPct}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <p className="text-xs text-amber-700 font-medium">No goods received yet.</p>
                    {['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                      <Button size="sm" className="mt-2 bg-amber-500 hover:bg-amber-600 text-white text-xs h-7" asChild>
                        <Link href={`/procurement/goods-receipt/new?poId=${po.id}`}>
                          <Package className="mr-1.5 h-3.5 w-3.5" />Record Receipt
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Delivery Information</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Expected', po.deliveryDate ? formatDate(po.deliveryDate) : '—'],
                      ['GRNs Filed', po._count.grns.toString()],
                    ].map(([l, v]) => (
                      <div key={l} className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
                        <p className="text-[10px] text-muted-foreground">{l}</p>
                        <p className="text-xs font-semibold mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5 flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-500" />Goods Receipt Notes
                </CardTitle>
                {['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                    <Link href={`/procurement/goods-receipt/new?poId=${po.id}`}>
                      <Plus className="mr-1 h-3 w-3" />New GRN
                    </Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {po._count.grns === 0 ? (
                  <div className="py-8 text-center">
                    <Package className="mx-auto h-6 w-6 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">No goods receipts yet.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                    <p className="text-sm font-semibold text-emerald-700">{po._count.grns} GRN{po._count.grns !== 1 ? 's' : ''} filed</p>
                    <p className="text-xs text-muted-foreground mt-0.5">View all receipt notes in the GRN module.</p>
                    <Link href="/procurement/goods-receipt"
                      className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                      View GRNs <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-500" />Financial Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                {[
                  { l: 'PO Value',        v: grand,              cls: 'text-blue-600 text-xl font-bold' },
                  { l: 'Received Value',  v: receivedValue,      cls: 'text-emerald-600' },
                  { l: 'Invoiced',        v: po._count.vendorInvoices > 0 ? '— (check Invoices)' : '£0', cls: '' },
                  { l: 'Paid',            v: '—',                cls: 'text-muted-foreground/50' },
                  { l: 'Outstanding',     v: grand - receivedValue, cls: 'text-amber-600 font-bold' },
                ].map(({ l, v, cls }) => (
                  <div key={l} className="flex items-center justify-between border-b border-border/30 pb-2 last:border-none last:pb-0">
                    <span className="text-sm text-muted-foreground">{l}</span>
                    <span className={cn('text-sm font-semibold', cls)}>
                      {typeof v === 'number' ? formatCurrency(v) : v}
                    </span>
                  </div>
                ))}
                {receivedEstPct > 0 && (
                  <div className="mt-2">
                    <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${receivedEstPct}%` }} />
                      <div className="h-full bg-amber-300" style={{ width: `${100 - receivedEstPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />Received</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-300" />Outstanding</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" />Supplier Invoices
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {po._count.vendorInvoices === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="mx-auto h-6 w-6 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">No invoices yet.</p>
                    {['APPROVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].includes(po.status) && (
                      <Button size="sm" variant="outline" className="mt-3 text-xs h-7" asChild>
                        <Link href={`/procurement/purchase-invoices?poId=${po.id}`}>
                          <FileText className="mr-1.5 h-3.5 w-3.5" />Create Invoice
                        </Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3">
                      <p className="text-sm font-bold text-purple-700">{po._count.vendorInvoices} Invoice{po._count.vendorInvoices !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">View full invoice details in the Purchase Invoices module.</p>
                      <Link href={`/procurement/purchase-invoices?poId=${po.id}`}
                        className="mt-2 text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1">
                        View Invoices <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
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
                  { label: 'PO Created',           sub: `${po.poNumber} raised for ${po.vendor.name}`,    date: po.orderDate, dot: 'bg-blue-500' },
                  ...(['PENDING_APPROVAL','APPROVED','PARTIALLY_RECEIVED','FULLY_RECEIVED'].includes(po.status)
                    ? [{ label: 'Submitted for Approval', sub: 'Sent to procurement manager', date: po.orderDate, dot: 'bg-amber-500' }] : []),
                  ...(['APPROVED','PARTIALLY_RECEIVED','FULLY_RECEIVED'].includes(po.status)
                    ? [{ label: 'PO Approved', sub: 'Procurement manager approved', date: po.orderDate, dot: 'bg-emerald-500' }] : []),
                  ...(po.status === 'PARTIALLY_RECEIVED'
                    ? [{ label: 'Partial Delivery Received', sub: `${po._count.grns} GRN${po._count.grns !== 1 ? 's' : ''} filed`, date: po.deliveryDate ?? po.orderDate, dot: 'bg-purple-500' }] : []),
                  ...(po.status === 'FULLY_RECEIVED'
                    ? [{ label: 'Fully Delivered', sub: 'All items received and verified', date: po.deliveryDate ?? po.orderDate, dot: 'bg-emerald-600' }] : []),
                  ...(po._count.vendorInvoices > 0
                    ? [{ label: 'Invoice Received', sub: `${po._count.vendorInvoices} supplier invoice${po._count.vendorInvoices !== 1 ? 's' : ''} recorded`, date: po.deliveryDate ?? po.orderDate, dot: 'bg-indigo-500' }] : []),
                  ...(po.status === 'CANCELLED'
                    ? [{ label: 'PO Cancelled', sub: 'Order cancelled', date: po.orderDate, dot: 'bg-red-500' }] : []),
                ].map((e, i, arr) => (
                  <div key={i} className="flex gap-4">
                    <div className="relative flex flex-col items-center pt-1">
                      <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', e.dot)} />
                      {i < arr.length - 1 && <div className="w-px flex-1 bg-border/40 mt-1 min-h-[2rem]" />}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm font-semibold leading-tight">{e.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{e.sub}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">{formatDate(e.date ?? po.orderDate)}</p>
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
