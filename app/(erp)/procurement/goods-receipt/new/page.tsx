'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft, Package, Truck, CheckCircle, XCircle, Warehouse,
  ChevronRight, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type PODetail = {
  id: string; poNumber: string; grandTotal: number; currency?: string
  vendor: { name: string; email: string | null }
  lineItems: Array<{
    id: string; description: string; quantity: number; uom: string
    unitPrice: number; receivedQty?: number
  }>
}

type GRNLine = {
  poLineItemId: string; receivedQty: string; acceptedQty: string
  rejectedQty: string; unitPrice: string; warehouseId: string
}

const INSPECTION_OPTIONS = [
  { value: 'passed',          label: 'Passed',               cls: 'text-emerald-600' },
  { value: 'passed_remarks',  label: 'Passed with Remarks',  cls: 'text-amber-600' },
  { value: 'failed',          label: 'Failed',               cls: 'text-red-600' },
]

const WAREHOUSE_OPTIONS = [
  'Main Warehouse', 'Raw Material Store', 'Finished Goods', 'Spare Parts Store',
]

const STEPS = ['PO & Delivery', 'Received Items', 'Inspection', 'Review & Submit']

// ── Main Page ─────────────────────────────────────────────────────────────────

function NewGRNPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const poId = searchParams.get('poId') ?? ''

  const [step, setStep]                     = useState(0)
  const [receivedDate, setReceivedDate]     = useState(new Date().toISOString().split('T')[0])
  const [receivedById, setReceivedById]     = useState('Warehouse')
  const [deliveryNote, setDeliveryNote]     = useState('')
  const [vehicle, setVehicle]               = useState('')
  const [driver, setDriver]                 = useState('')
  const [warehouse, setWarehouse]           = useState('Main Warehouse')
  const [inspectionResult, setInspResult]   = useState('passed')
  const [inspectionNotes, setInspNotes]     = useState('')
  const [saving, setSaving]                 = useState(false)
  const [lines, setLines]                   = useState<GRNLine[]>([])

  const { data: po, isLoading } = useQuery({
    queryKey: ['po-for-grn', poId],
    queryFn: () => api.get<PODetail>(`/api/procurement/purchase-orders/${poId}`).then(r => r.data!),
    enabled: !!poId,
  })

  // Init lines once PO loads
  if (po && lines.length === 0) {
    setLines(po.lineItems.map(li => ({
      poLineItemId: li.id,
      receivedQty:  String(Math.max(0, Number(li.quantity) - Number(li.receivedQty ?? 0))),
      acceptedQty:  String(Math.max(0, Number(li.quantity) - Number(li.receivedQty ?? 0))),
      rejectedQty:  '0',
      unitPrice:    String(Number(li.unitPrice)),
      warehouseId:  '',
    })))
  }

  const update = (i: number, k: keyof GRNLine, v: string) =>
    setLines(p => p.map((r, j) => j === i ? { ...r, [k]: v } : r))

  // Auto-sync acceptedQty = receivedQty - rejectedQty
  const updateReceived = (i: number, v: string) => {
    setLines(p => p.map((r, j) => {
      if (j !== i) return r
      const rec = Number(v)
      const rej = Number(r.rejectedQty)
      return { ...r, receivedQty: v, acceptedQty: String(Math.max(0, rec - rej)) }
    }))
  }
  const updateRejected = (i: number, v: string) => {
    setLines(p => p.map((r, j) => {
      if (j !== i) return r
      const rej = Number(v)
      const rec = Number(r.receivedQty)
      return { ...r, rejectedQty: v, acceptedQty: String(Math.max(0, rec - rej)) }
    }))
  }

  const totalReceived = lines.reduce((s, l) => s + Number(l.acceptedQty) * Number(l.unitPrice), 0)
  const totalRejected = lines.reduce((s, l) => s + Number(l.rejectedQty) * Number(l.unitPrice), 0)
  const totalQty      = po?.lineItems.reduce((s, li) => s + Number(li.quantity), 0) ?? 0
  const receivedQty   = lines.reduce((s, l) => s + Number(l.acceptedQty), 0)

  async function handleSubmit() {
    if (!poId) return toast.error('No PO selected')
    setSaving(true)
    const notes = [
      deliveryNote && `Delivery Note: ${deliveryNote}`,
      vehicle      && `Vehicle: ${vehicle}`,
      driver       && `Driver: ${driver}`,
      `Inspection: ${INSPECTION_OPTIONS.find(o => o.value === inspectionResult)?.label}`,
      inspectionNotes && `Inspection Notes: ${inspectionNotes}`,
    ].filter(Boolean).join(' | ')
    try {
      const res = await api.post<{ id: string }>('/api/procurement/grns', {
        poId, receivedDate, receivedById, notes: notes || undefined,
        lineItems: lines.map(l => ({
          poLineItemId: l.poLineItemId,
          receivedQty:  Number(l.receivedQty),
          acceptedQty:  Number(l.acceptedQty),
          rejectedQty:  Number(l.rejectedQty),
          unitPrice:    Number(l.unitPrice),
        })),
      })
      toast.success('Goods receipt recorded — inventory updated')
      router.push(`/procurement/goods-receipt/${res.data!.id}`)
    } catch {
      toast.error('Failed to create GRN')
    } finally {
      setSaving(false)
    }
  }

  if (!poId) return (
    <div className="py-20 text-center">
      <Package className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">No PO specified.</p>
      <Button size="sm" variant="outline" className="mt-3 text-xs" asChild>
        <Link href="/procurement/purchase-orders">Browse Purchase Orders</Link>
      </Button>
    </div>
  )
  if (isLoading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
    </div>
  )
  if (!po) return <div className="py-20 text-center text-sm text-muted-foreground">PO not found.</div>

  return (
    <div className="space-y-5">
      {/* ── Sticky wizard header ── */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-border/60 bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link href={`/procurement/purchase-orders/${poId}`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-base font-bold leading-tight">Receive Goods</h1>
              <p className="text-xs text-muted-foreground">{po.poNumber} · {po.vendor.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">PO Value</p>
            <p className="text-sm font-bold text-blue-600">{formatCurrency(Number(po.grandTotal))}</p>
          </div>
        </div>
        {/* Step bar */}
        <div className="flex items-center gap-0.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-0.5 flex-1 min-w-0">
              <button type="button" onClick={() => i < step && setStep(i)}
                className={cn(
                  'flex-1 rounded-full px-2 py-1 text-[10px] font-semibold text-center truncate',
                  i < step ? 'bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200'
                    : i === step ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground/40',
                )}>
                {i < step && <span className="mr-0.5">✓</span>}{s}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/20" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Step 0: PO & Delivery ── */}
      {step === 0 && (
        <div className="space-y-4">
          {/* PO summary card */}
          <Card className="border-blue-200 bg-blue-50/40 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                <Package className="h-4 w-4" />PO Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { l: 'PO Number',   v: po.poNumber },
                  { l: 'Supplier',    v: po.vendor.name },
                  { l: 'PO Value',    v: formatCurrency(Number(po.grandTotal)) },
                  { l: 'Line Items',  v: po.lineItems.length.toString() },
                  { l: 'Ordered Qty', v: totalQty.toString() },
                  { l: 'Items',       v: po.lineItems.map(li => li.description).join(', ').slice(0, 40) + (po.lineItems.length > 2 ? '…' : '') },
                ].map(({ l, v }) => (
                  <div key={l} className="rounded-lg border border-blue-200/60 bg-white/60 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">{l}</p>
                    <p className="text-xs font-medium mt-0.5 truncate text-blue-900">{v}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Delivery information */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-purple-500" />Delivery Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Receipt Date *</Label>
                <Input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Received By *</Label>
                <Input value={receivedById} onChange={e => setReceivedById(e.target.value)} placeholder="Name or ID" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Warehouse</Label>
                <Select value={warehouse} onValueChange={setWarehouse}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WAREHOUSE_OPTIONS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Delivery Note #</Label>
                <Input value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} placeholder="DN-2026-001" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Vehicle Number</Label>
                <Input value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="ABC-1234" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Driver Name</Label>
                <Input value={driver} onChange={e => setDriver(e.target.value)} placeholder="Driver name" className="h-8 text-xs" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 1: Received Items ── */}
      {step === 1 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-500" />Enter Received Quantities
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50">
                      {['Description', 'Ordered', 'Received', 'Rejected', 'Accepted', 'Unit Price', 'Value'].map((h, i) => (
                        <th key={h} className={cn('pb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70',
                          i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {po.lineItems.map((li, i) => {
                      const line = lines[i]
                      if (!line) return null
                      const value = Number(line.acceptedQty) * Number(line.unitPrice)
                      const over  = Number(line.receivedQty) > Number(li.quantity)
                      return (
                        <tr key={li.id} className={cn('', over && 'bg-red-50/30')}>
                          <td className="py-2.5 pr-2">
                            <p className="font-medium">{li.description}</p>
                            <p className="text-[10px] text-muted-foreground">{li.uom}</p>
                          </td>
                          <td className="py-2.5 text-right text-muted-foreground font-semibold">{Number(li.quantity)}</td>
                          <td className="py-2.5 pr-1">
                            <Input type="number" min="0" step="any" value={line.receivedQty}
                              onChange={e => updateReceived(i, e.target.value)}
                              className={cn('h-7 text-xs text-right w-20', over && 'border-red-300 bg-red-50')} />
                          </td>
                          <td className="py-2.5 pr-1">
                            <Input type="number" min="0" step="any" value={line.rejectedQty}
                              onChange={e => updateRejected(i, e.target.value)}
                              className="h-7 text-xs text-right w-20 border-red-200" />
                          </td>
                          <td className="py-2.5 text-right">
                            <span className={cn('font-bold', Number(line.acceptedQty) > 0 ? 'text-emerald-600' : 'text-muted-foreground/40')}>
                              {line.acceptedQty}
                            </span>
                          </td>
                          <td className="py-2.5 pr-1">
                            <Input type="number" min="0" step="0.01" value={line.unitPrice}
                              onChange={e => update(i, 'unitPrice', e.target.value)}
                              className="h-7 text-xs text-right w-24" />
                          </td>
                          <td className="py-2.5 text-right font-semibold">{formatCurrency(value)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {lines.some((l, i) => Number(l.receivedQty) > Number(po.lineItems[i]?.quantity ?? 0)) && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700">One or more items exceed the ordered quantity. Please verify.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost summary sidebar */}
          <Card className="border-border/60 shadow-sm sticky top-28 self-start">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Receipt Summary</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {/* Qty tracking */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2.5">
                {[
                  { l: 'Ordered',  v: totalQty,    cls: 'text-muted-foreground' },
                  { l: 'Received', v: receivedQty, cls: 'text-emerald-600 font-bold' },
                  { l: 'Remaining',v: Math.max(0, totalQty - receivedQty), cls: 'text-amber-600' },
                ].map(({ l, v, cls }) => (
                  <div key={l} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{l}</span>
                    <span className={cn('font-semibold', cls)}>{v}</span>
                  </div>
                ))}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: totalQty > 0 ? `${Math.min(100, Math.round(receivedQty / totalQty * 100))}%` : '0%' }} />
                </div>
                <p className="text-[10px] text-muted-foreground/50 text-right">
                  {totalQty > 0 ? Math.min(100, Math.round(receivedQty / totalQty * 100)) : 0}% received
                </p>
              </div>
              {/* Value summary */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Accepted Value</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(totalReceived)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Rejected Value</span>
                  <span className="font-semibold text-red-500">{formatCurrency(totalRejected)}</span>
                </div>
                <div className="border-t border-border/50 pt-2 flex justify-between">
                  <span className="text-sm font-bold">Total Value</span>
                  <span className="text-lg font-bold text-blue-600">{formatCurrency(totalReceived + totalRejected)}</span>
                </div>
              </div>
              {/* Stock preview */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Stock Impact</p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Incoming (accepted)</span>
                  <span className="font-bold text-emerald-700">+{receivedQty} units</span>
                </div>
                <p className="text-[10px] text-emerald-600">Stock will update on GRN submission</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 2: Inspection ── */}
      {step === 2 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />Quality Inspection
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Inspection Result *</p>
                <div className="grid grid-cols-1 gap-2">
                  {INSPECTION_OPTIONS.map(o => (
                    <button key={o.value} type="button" onClick={() => setInspResult(o.value)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold transition-all',
                        inspectionResult === o.value
                          ? o.value === 'passed' ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : o.value === 'passed_remarks' ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-red-300 bg-red-50 text-red-700'
                          : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40',
                      )}>
                      {o.value === 'passed' ? <CheckCircle className="h-4 w-4 shrink-0" />
                        : o.value === 'passed_remarks' ? <AlertTriangle className="h-4 w-4 shrink-0" />
                        : <XCircle className="h-4 w-4 shrink-0" />}
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Inspection Notes</Label>
                <Textarea value={inspectionNotes} onChange={e => setInspNotes(e.target.value)}
                  placeholder="Note any quality issues, batch numbers, or remarks…"
                  className="min-h-[80px] resize-none text-xs" />
              </div>
            </CardContent>
          </Card>

          {/* Quality summary table */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Quality Check Summary</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Item', 'Received', 'Accepted', 'Rejected'].map((h, i) => (
                      <th key={h} className={cn('pb-2 text-[10px] font-semibold uppercase text-muted-foreground/60', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {po.lineItems.map((li, i) => {
                    const line = lines[i]
                    if (!line) return null
                    return (
                      <tr key={li.id}>
                        <td className="py-2 font-medium truncate max-w-[120px]">{li.description}</td>
                        <td className="py-2 text-right">{Number(line.receivedQty)}</td>
                        <td className="py-2 text-right text-emerald-600 font-semibold">{Number(line.acceptedQty)}</td>
                        <td className="py-2 text-right text-red-500">{Number(line.rejectedQty) || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td className="pt-2 text-xs font-bold">Total</td>
                    <td className="pt-2 text-right font-semibold">{lines.reduce((s, l) => s + Number(l.receivedQty), 0)}</td>
                    <td className="pt-2 text-right font-bold text-emerald-600">{receivedQty}</td>
                    <td className="pt-2 text-right font-bold text-red-500">{lines.reduce((s, l) => s + Number(l.rejectedQty), 0) || '—'}</td>
                  </tr>
                </tfoot>
              </table>
              {inspectionResult === 'failed' && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />Inspection Failed
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">Items will be recorded as rejected. Stock will not be updated for failed items.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold">GRN Review</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['PO Number',    po.poNumber],
                    ['Supplier',     po.vendor.name],
                    ['Receipt Date', receivedDate],
                    ['Received By',  receivedById],
                    ['Warehouse',    warehouse],
                    ['Delivery Note',deliveryNote || '—'],
                    ['Inspection',   INSPECTION_OPTIONS.find(o => o.value === inspectionResult)?.label ?? ''],
                    ['Vehicle',      vehicle || '—'],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
                      <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase">{l}</p>
                      <p className="text-xs font-medium mt-0.5 truncate">{v}</p>
                    </div>
                  ))}
                </div>
                {inspectionNotes && (
                  <div className="rounded-lg border-l-2 border-amber-300 bg-amber-50/30 px-3 py-2">
                    <p className="text-xs text-foreground">{inspectionNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stock impact confirmation */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-sm font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                <Warehouse className="h-4 w-4" />Stock Update on Submission
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { l: 'Accepted',  v: receivedQty,                                                    cls: 'text-emerald-700' },
                  { l: 'Rejected',  v: lines.reduce((s, l) => s + Number(l.rejectedQty), 0),           cls: 'text-red-600' },
                  { l: 'GRN Value', v: formatCurrency(totalReceived),                                   cls: 'text-blue-700' },
                ].map(({ l, v, cls }) => (
                  <div key={l}><p className={cn('text-lg font-bold', cls)}>{v}</p><p className="text-[10px] text-muted-foreground">{l}</p></div>
                ))}
              </div>
            </div>
          </div>

          {/* Items confirmation table */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Items Confirmation</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Description', 'Ordered', 'Accepted', 'Rejected', 'Value'].map((h, i) => (
                      <th key={h} className={cn('pb-2 text-[10px] font-semibold uppercase text-muted-foreground/60', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {po.lineItems.map((li, i) => {
                    const line = lines[i]; if (!line) return null
                    const full = Number(line.acceptedQty) === Number(li.quantity) && Number(line.rejectedQty) === 0
                    return (
                      <tr key={li.id}>
                        <td className="py-2 font-medium">{li.description}</td>
                        <td className="py-2 text-right text-muted-foreground">{Number(li.quantity)}</td>
                        <td className="py-2 text-right">
                          <span className={cn('font-semibold', full ? 'text-emerald-600' : 'text-amber-600')}>{Number(line.acceptedQty)}</span>
                        </td>
                        <td className="py-2 text-right text-red-500">{Number(line.rejectedQty) || '—'}</td>
                        <td className="py-2 text-right font-semibold">{formatCurrency(Number(line.acceptedQty) * Number(line.unitPrice))}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={4} className="pt-2 font-bold text-xs">Total Accepted Value</td>
                    <td className="pt-2 text-right font-bold text-emerald-600">{formatCurrency(totalReceived)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Sticky footer ── */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-border/60 bg-background/95 backdrop-blur px-4 py-3">
        <Button type="button" variant="outline" className="text-xs h-8"
          onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}>
          {step === 0 ? 'Cancel' : '← Back'}
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-emerald-600">{formatCurrency(totalReceived)}</span> accepted
        </div>
        {step < 3 ? (
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
            onClick={() => setStep(s => s + 1)}
            disabled={step === 0 && (!receivedDate || !receivedById)}>
            Next →
          </Button>
        ) : (
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
            onClick={handleSubmit} disabled={saving || lines.length === 0}>
            {saving ? 'Recording…' : 'Submit GRN'}
          </Button>
        )}

      </div>
    </div>
  )
}

export default function NewGRNPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <NewGRNPageContent />
    </Suspense>
  )
}