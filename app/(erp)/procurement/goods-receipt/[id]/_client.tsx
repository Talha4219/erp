'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft, Package, CheckCircle, XCircle, Receipt, ChevronRight,
  Users, TrendingUp, Activity, Warehouse, FileText, Clock,
} from 'lucide-react'
import Link from 'next/link'

type GRNLineItem = {
  id: string; poLineItemId: string
  receivedQty: number; acceptedQty: number; rejectedQty: number; unitPrice: number
}
type POLineItem = {
  id: string; description: string; quantity: number; uom: string; unitPrice: number
  item?: { name: string; sku: string | null } | null
}
type GRNDetail = {
  id: string; grnNumber: string; receivedDate: string
  receivedById: string; notes: string | null
  po: {
    id: string; poNumber: string; grandTotal: number
    vendor: { id: string; name: string; email: string | null; phone: string | null }
    lineItems: POLineItem[]
  }
  lineItems: GRNLineItem[]
}

const WORKFLOW = [
  { key: 'po',       label: 'PO Approved' },
  { key: 'delivery', label: 'Delivered' },
  { key: 'inspect',  label: 'Inspected' },
  { key: 'grn',      label: 'GRN Created' },
  { key: 'invoice',  label: 'Invoiced' },
  { key: 'payment',  label: 'Payment' },
]

export function PageClient({ id, initialData }: { id: string; initialData: GRNDetail }) {
  const { data: grn, isLoading } = useQuery({
    queryKey: ['grn', id],
    queryFn: () => api.get<GRNDetail>(`/api/procurement/grns/${id}`).then(r => r.data!),
    initialData,
    staleTime: 30_000,
  })

  if (isLoading) return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
    </div>
  )
  if (!grn) return <div className="py-20 text-center text-sm text-muted-foreground">GRN not found.</div>

  const acceptedValue  = grn.lineItems.reduce((s, l) => s + Number(l.acceptedQty)  * Number(l.unitPrice), 0)
  const rejectedValue  = grn.lineItems.reduce((s, l) => s + Number(l.rejectedQty)  * Number(l.unitPrice), 0)
  const totalAccepted  = grn.lineItems.reduce((s, l) => s + Number(l.acceptedQty), 0)
  const totalRejected  = grn.lineItems.reduce((s, l) => s + Number(l.rejectedQty), 0)
  const totalOrdered   = grn.po.lineItems.reduce((s, l) => s + Number(l.quantity), 0)
  const hasRejections  = totalRejected > 0

  const inspectionLine = grn.notes?.split('|').find(p => p.trim().startsWith('Inspection:'))?.replace('Inspection:', '').trim()
  const inspFailed     = inspectionLine?.toLowerCase().includes('failed')
  const inspPassed     = !inspFailed

  const merged = grn.po.lineItems.map(poli => {
    const grnLi = grn.lineItems.find(g => g.poLineItemId === poli.id)
    return {
      ...poli,
      receivedQty:  Number(grnLi?.receivedQty  ?? 0),
      acceptedQty:  Number(grnLi?.acceptedQty  ?? 0),
      rejectedQty:  Number(grnLi?.rejectedQty  ?? 0),
      grnUnitPrice: Number(grnLi?.unitPrice     ?? poli.unitPrice),
    }
  })

  const receivePct = totalOrdered > 0 ? Math.round(totalAccepted / totalOrdered * 100) : 0

  const poValue  = Number(grn.po.grandTotal)
  const grnValue = acceptedValue
  const matched  = Math.abs(poValue - grnValue) / Math.max(poValue, 1) < 0.05

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0" asChild>
            <Link href="/procurement/goods-receipt"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">{grn.grnNumber}</h1>
              <span className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                inspFailed
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : hasRejections
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200',
              )}>
                {inspFailed ? 'Failed Inspection' : hasRejections ? 'Partial Accept' : 'Completed'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>{grn.po.vendor.name}</strong>
              {' · '}
              <Link href={`/procurement/purchase-orders/${grn.po.id}`}
                className="text-blue-600 hover:underline">PO: {grn.po.poNumber}</Link>
              {' · '}{formatDate(grn.receivedDate)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" asChild>
            <Link href={`/procurement/purchase-invoices?poId=${grn.po.id}&amount=${acceptedValue.toFixed(2)}`}>
              <Receipt className="mr-1.5 h-3.5 w-3.5" />Create Invoice
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
            <Link href={`/procurement/purchase-orders/${grn.po.id}`}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />View PO
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
            Receipt Lifecycle
          </p>
          <div className="flex items-center flex-wrap gap-y-2 overflow-x-auto pb-1">
            {WORKFLOW.map((step, i) => {
              const done   = i <= 3
              const active = i === 3
              return (
                <div key={step.key} className="flex items-center shrink-0">
                  <div className={cn(
                    'flex h-7 items-center rounded-full px-2.5 text-[10px] font-semibold',
                    done && !active ? 'bg-emerald-100 text-emerald-700'
                      : active ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground/40',
                  )}>
                    {done && !active && <span className="mr-0.5 text-[8px]">✓</span>}
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
          { Icon: TrendingUp,  label: 'Accepted Value', value: formatCurrency(acceptedValue), big: true, cls: 'text-emerald-600' },
          { Icon: Package,     label: 'Items Accepted',  value: totalAccepted.toString() },
          { Icon: XCircle,     label: 'Items Rejected',  value: totalRejected.toString(), warn: totalRejected > 0 },
          { Icon: Clock,       label: 'Received By',     value: grn.receivedById },
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
            { value: 'overview',  label: 'Overview',          Icon: Warehouse },
            { value: 'items',     label: `Items (${merged.length})`, Icon: Package },
            { value: 'matching',  label: '3-Way Match',       Icon: CheckCircle },
            { value: 'activity',  label: 'Activity',          Icon: Activity },
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
                  <Users className="h-4 w-4 text-blue-500" />Delivery Details
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Supplier',      grn.po.vendor.name],
                    ['Email',         grn.po.vendor.email ?? '—'],
                    ['Receipt Date',  formatDate(grn.receivedDate)],
                    ['Received By',   grn.receivedById],
                    ['PO Reference',  grn.po.poNumber],
                    ['GRN Number',    grn.grnNumber],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</p>
                      <p className="text-xs font-medium mt-0.5 truncate">{v}</p>
                    </div>
                  ))}
                </div>
                {grn.notes && (
                  <div className="rounded-lg border-l-2 border-blue-200 bg-blue-50/30 px-3 py-2 space-y-1">
                    <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Notes</p>
                    {grn.notes.split('|').map((n, i) => (
                      <p key={i} className="text-xs text-foreground">{n.trim()}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />Receipt Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { l: 'Ordered',  v: totalOrdered,  cls: 'text-blue-600' },
                    { l: 'Accepted', v: totalAccepted, cls: 'text-emerald-600' },
                    { l: 'Rejected', v: totalRejected, cls: totalRejected > 0 ? 'text-red-600' : 'text-muted-foreground/40' },
                  ].map(({ l, v, cls }) => (
                    <div key={l} className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                      <p className={cn('text-xl font-bold', cls)}>{v}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{l}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold">Acceptance Rate</span>
                    <span className={cn('text-xs font-bold', receivePct === 100 ? 'text-emerald-600' : receivePct >= 80 ? 'text-amber-600' : 'text-red-500')}>
                      {receivePct}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: `${receivePct}%` }} />
                    {totalRejected > 0 && (
                      <div className="h-full bg-red-400"
                        style={{ width: `${Math.round(totalRejected / totalOrdered * 100)}%` }} />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 border-t border-border/40 pt-3">
                  {[
                    { l: 'Accepted Value', v: acceptedValue, cls: 'text-emerald-600 font-bold' },
                    { l: 'Rejected Value', v: rejectedValue, cls: rejectedValue > 0 ? 'text-red-500' : 'text-muted-foreground/40' },
                    { l: 'PO Value',       v: poValue,       cls: 'text-blue-600' },
                  ].map(({ l, v, cls }) => (
                    <div key={l} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{l}</span>
                      <span className={cn('font-semibold', cls)}>{formatCurrency(v)}</span>
                    </div>
                  ))}
                </div>
                <div className={cn(
                  'rounded-xl border p-3',
                  inspFailed ? 'border-red-200 bg-red-50/50' : 'border-emerald-200 bg-emerald-50/50',
                )}>
                  <div className="flex items-center gap-2">
                    {inspFailed
                      ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      : <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                    <div>
                      <p className={cn('text-xs font-bold', inspFailed ? 'text-red-700' : 'text-emerald-700')}>
                        {inspectionLine ?? (inspPassed ? 'Inspection Passed' : 'Inspection Result Unknown')}
                      </p>
                      {grn.notes && <p className="text-[10px] text-muted-foreground mt-0.5">See Notes for details</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="items">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Receipt Details — Line by Line</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50">
                      {['#', 'Description', 'SKU', 'Ordered', 'Received', 'Accepted', 'Rejected', 'Unit Price', 'Accepted Value', 'Match'].map((h, i) => (
                        <th key={h} className={cn('pb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60',
                          i <= 2 ? 'text-left' : i === 9 ? 'text-center' : 'text-right')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {merged.map((li, i) => {
                      const fullMatch = li.acceptedQty === Number(li.quantity) && li.rejectedQty === 0
                      const partial   = li.acceptedQty > 0 && li.acceptedQty < Number(li.quantity)
                      const short     = li.acceptedQty === 0 && li.receivedQty === 0
                      return (
                        <tr key={li.id} className={cn('hover:bg-muted/30 transition-colors',
                          li.rejectedQty > 0 && 'bg-red-50/20')}>
                          <td className="py-2.5 text-muted-foreground/40 w-7">{i + 1}</td>
                          <td className="py-2.5 font-medium">{li.item?.name ?? li.description}</td>
                          <td className="py-2.5 text-muted-foreground">{li.item?.sku ?? '—'}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{Number(li.quantity)} {li.uom}</td>
                          <td className="py-2.5 text-right">{li.receivedQty}</td>
                          <td className="py-2.5 text-right font-semibold text-emerald-600">{li.acceptedQty}</td>
                          <td className="py-2.5 text-right text-red-500">{li.rejectedQty > 0 ? li.rejectedQty : '—'}</td>
                          <td className="py-2.5 text-right">{formatCurrency(li.grnUnitPrice)}</td>
                          <td className="py-2.5 text-right font-semibold">{formatCurrency(li.acceptedQty * li.grnUnitPrice)}</td>
                          <td className="py-2.5 text-center">
                            <span className={cn(
                              'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                              fullMatch ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : partial  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : short    ? 'bg-slate-100 text-slate-500 border-slate-200'
                                : 'bg-red-50 text-red-600 border-red-200',
                            )}>
                              {fullMatch ? 'Full' : partial ? 'Partial' : short ? 'Pending' : 'Short'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border/50">
                      <td colSpan={8} className="pt-3 text-xs font-bold">Total Accepted Value</td>
                      <td className="pt-3 text-right font-bold text-emerald-600">{formatCurrency(acceptedValue)}</td>
                      <td />
                    </tr>
                    {rejectedValue > 0 && (
                      <tr>
                        <td colSpan={8} className="pt-1 text-xs font-semibold text-red-600">Rejected Value</td>
                        <td className="pt-1 text-right font-bold text-red-600">{formatCurrency(rejectedValue)}</td>
                        <td />
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matching" className="space-y-4">
          <div className={cn(
            'flex items-center gap-3 rounded-xl border px-4 py-3',
            matched ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800',
          )}>
            {matched
              ? <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              : <XCircle className="h-5 w-5 text-amber-500 shrink-0" />}
            <div>
              <p className="text-sm font-bold">
                {matched ? 'Three-Way Match: Passed' : 'Three-Way Match: Variance Detected'}
              </p>
              <p className="text-xs mt-0.5">
                {matched
                  ? 'PO value, GRN value, and expected invoice amount are within tolerance.'
                  : 'GRN accepted value differs from PO value by more than 5%. Review before approving invoice.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />Value Comparison
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                {[
                  { label: 'Purchase Order',   value: poValue,     icon: FileText,  cls: 'text-blue-600',    bg: 'bg-blue-50',    check: true },
                  { label: 'GRN Accepted',     value: grnValue,    icon: Package,   cls: 'text-emerald-600', bg: 'bg-emerald-50', check: true },
                  { label: 'Expected Invoice', value: grnValue,    icon: Receipt,   cls: 'text-purple-600',  bg: 'bg-purple-50',  check: matched },
                ].map(({ label, value, icon: Icon, cls, bg, check }) => (
                  <div key={label} className={cn('flex items-center gap-3 rounded-xl border p-3', check ? 'border-border/50' : 'border-amber-200 bg-amber-50/30')}>
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', bg)}>
                      <Icon className={cn('h-4 w-4', cls)} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={cn('text-base font-bold', cls)}>{formatCurrency(value)}</p>
                    </div>
                    {check
                      ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      : <XCircle className="h-4 w-4 text-amber-500 shrink-0" />}
                  </div>
                ))}
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">PO vs GRN Variance</span>
                    <span className={cn('font-bold', Math.abs(poValue - grnValue) < 1 ? 'text-emerald-600' : 'text-amber-600')}>
                      {formatCurrency(Math.abs(poValue - grnValue))}
                      {' '}({Math.abs(poValue - grnValue) < 1 ? '0' : Math.round(Math.abs(poValue - grnValue) / poValue * 100)}%)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />Match Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                {[
                  { label: 'Purchase Order Approved',   done: true,     detail: grn.po.poNumber },
                  { label: 'Goods Received',            done: true,     detail: formatDate(grn.receivedDate) },
                  { label: 'Inspection Passed',         done: inspPassed, detail: inspectionLine ?? 'No inspection record' },
                  { label: 'GRN Created',               done: true,     detail: grn.grnNumber },
                  { label: 'Quantities Match PO',       done: receivePct === 100, detail: `${receivePct}% received` },
                  { label: 'Value Within Tolerance',    done: matched,  detail: matched ? 'Within 5%' : 'Variance detected' },
                  { label: 'Invoice Received',          done: false,    detail: 'Pending' },
                ].map(({ label, done, detail }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 h-4 w-4 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold',
                      done ? 'bg-emerald-500 text-white' : 'bg-muted border border-border/60',
                    )}>
                      {done && '✓'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-[10px] text-muted-foreground/60 truncate">{detail}</p>
                    </div>
                  </div>
                ))}
                <div className="border-t border-border/40 pt-3">
                  <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-xs h-8" asChild>
                    <Link href={`/procurement/purchase-invoices?poId=${grn.po.id}&amount=${acceptedValue.toFixed(2)}`}>
                      <Receipt className="mr-1.5 h-3.5 w-3.5" />Create Matched Invoice
                    </Link>
                  </Button>
                </div>
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
                  { label: 'Delivery Arrived',        sub: `From ${grn.po.vendor.name} against ${grn.po.poNumber}`, dot: 'bg-blue-500' },
                  { label: 'Goods Inspection',        sub: inspectionLine ?? 'Quality check performed',             dot: inspFailed ? 'bg-red-500' : 'bg-amber-500' },
                  { label: inspFailed ? 'Inspection Failed' : 'Inspection Passed',
                    sub: inspFailed ? 'Items quarantined for review' : 'All items cleared for stock', dot: inspFailed ? 'bg-red-500' : 'bg-emerald-500' },
                  { label: 'GRN Created',             sub: `${grn.grnNumber} — ${totalAccepted} units accepted`, dot: 'bg-emerald-600' },
                  ...( hasRejections ? [{ label: 'Rejection Recorded', sub: `${totalRejected} units rejected — ${formatCurrency(rejectedValue)}`, dot: 'bg-red-400' }] : []),
                  { label: 'Inventory Updated',       sub: `+${totalAccepted} units added to stock`,              dot: 'bg-purple-500' },
                  { label: 'Ready for Invoice',       sub: `${formatCurrency(acceptedValue)} pending supplier invoice`, dot: 'bg-slate-400' },
                ].map((e, i, arr) => (
                  <div key={i} className="flex gap-4">
                    <div className="relative flex flex-col items-center pt-1">
                      <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', e.dot)} />
                      {i < arr.length - 1 && <div className="w-px flex-1 bg-border/40 mt-1 min-h-[2rem]" />}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm font-semibold leading-tight">{e.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{e.sub}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">{formatDate(grn.receivedDate)}</p>
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
