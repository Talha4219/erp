'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  Eye, Plus, FileText, Clock, CheckCircle, TrendingUp,
  Search, Filter, X, ChevronRight, Trash2, Star, BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type SQ = {
  id: string; sqNumber: string; status: string; quotationDate: string
  validUntil: string; totalAmount: number
  vendor: { name: string }; rfq: { rfqNumber: string } | null
  purchaseOrder: { poNumber: string } | null
}
type Vendor = { id: string; name: string }

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  RECEIVED:     { label: 'Received',       cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  UNDER_REVIEW: { label: 'Under Review',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACCEPTED:     { label: 'Awarded',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED:     { label: 'Rejected',       cls: 'bg-red-50 text-red-600 border-red-200' },
}

// Spec sample data
const STATUS_DIST = [
  { label: 'Received',   count: 85, color: 'bg-blue-500' },
  { label: 'Evaluation', count: 25, color: 'bg-amber-400' },
  { label: 'Awarded',    count: 35, color: 'bg-emerald-500' },
  { label: 'Rejected',   count: 11, color: 'bg-red-400' },
]
const PRICE_COMP = [
  { name: 'ABC Traders',     price: 38_000 },
  { name: 'Global Supply',   price: 40_500 },
  { name: 'Prime Industrial',price: 39_200 },
  { name: 'Mega Parts',      price: 42_000 },
]
const EVAL_SCORES = [
  { name: 'ABC Traders',     score: 92 },
  { name: 'Prime Industrial',score: 88 },
  { name: 'Global Supply',   score: 83 },
  { name: 'Mega Parts',      score: 76 },
]

const UOM_OPTIONS = ['EA', 'PCS', 'BOX', 'SET', 'KG', 'LTR', 'MTR', 'ROLL', 'PACK']

function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) }

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', cfg?.cls ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
      {cfg?.label ?? status}
    </span>
  )
}

// ── Add Quotation Dialog ───────────────────────────────────────────────────────
function AddQuotationDialog({ open, onClose, onSuccess, vendors }: {
  open: boolean; onClose: () => void; onSuccess: () => void; vendors: Vendor[]
}) {
  const [step, setStep] = useState<'info' | 'items' | 'review'>('info')
  const [form, setForm] = useState({ vendorId: '', rfqRef: '', quotationDate: '', validUntil: '', currency: 'GBP', notes: '' })
  const [rows, setRows] = useState([{ description: '', quantity: '1', uom: 'EA', unitPrice: '0', taxRate: '0' }])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const addRow = () => setRows(p => [...p, { description: '', quantity: '1', uom: 'EA', unitPrice: '0', taxRate: '0' }])
  const removeRow = (i: number) => setRows(p => p.filter((_, j) => j !== i))
  const updateRow = (i: number, k: string, v: string) => setRows(p => p.map((r, j) => j === i ? { ...r, [k]: v } : r))

  const subtotal = rows.reduce((s, r) => s + Number(r.unitPrice) * Number(r.quantity), 0)
  const tax      = rows.reduce((s, r) => s + Number(r.unitPrice) * Number(r.quantity) * (Number(r.taxRate) / 100), 0)

  const mutation = useMutation({
    mutationFn: () => api.post('/api/procurement/supplier-quotations', {
      vendorId: form.vendorId,
      quotationDate: form.quotationDate,
      validUntil: form.validUntil,
      currency: form.currency,
      notes: form.notes || undefined,
      lineItems: rows.filter(r => r.description.trim()).map(r => ({
        description: r.description, quantity: Number(r.quantity), uom: r.uom,
        unitPrice: Number(r.unitPrice), taxRate: Number(r.taxRate),
      })),
    }),
    onSuccess: () => { toast.success('Quotation recorded'); onSuccess(); handleClose() },
    onError: () => toast.error('Failed to save quotation'),
  })

  function handleClose() {
    setStep('info'); setForm({ vendorId: '', rfqRef: '', quotationDate: '', validUntil: '', currency: 'GBP', notes: '' })
    setRows([{ description: '', quantity: '1', uom: 'EA', unitPrice: '0', taxRate: '0' }]); onClose()
  }

  const infoValid = !!form.vendorId && !!form.quotationDate && !!form.validUntil
  const itemsValid = rows.some(r => r.description.trim())
  const STEPS = [
    { key: 'info' as const, order: 0, label: 'General Info' },
    { key: 'items' as const, order: 1, label: 'Items & Pricing' },
    { key: 'review' as const, order: 2, label: 'Review' },
  ]
  const currentOrder = STEPS.find(s => s.key === step)!.order
  const supplier = vendors.find(v => v.id === form.vendorId)

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border/60 bg-white px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold">Record Supplier Quotation</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Enter quotation details received from supplier</p>
            </div>
            <button type="button" onClick={handleClose} className="text-muted-foreground/40 hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => {
              const done = s.order < currentOrder; const active = s.key === step
              return (
                <div key={s.key} className="flex items-center gap-1.5">
                  <button type="button" onClick={() => (done || active) && setStep(s.key)}
                    className={cn('flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
                      active ? 'bg-blue-600 text-white' : done ? 'bg-emerald-100 text-emerald-700 cursor-pointer' : 'bg-muted text-muted-foreground/40',
                    )}>
                    {done ? '✓ ' : `${i + 1}. `}{s.label}
                  </button>
                  {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 min-h-[300px]">
          {/* Step 1 – General Info */}
          {step === 'info' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Supplier <span className="text-red-500">*</span></Label>
                <Select value={form.vendorId} onValueChange={v => setF('vendorId', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Quotation Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.quotationDate} onChange={e => setF('quotationDate', e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Valid Until <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.validUntil} onChange={e => setF('validUntil', e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Currency</Label>
                <Select value={form.currency} onValueChange={v => setF('currency', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{['GBP', 'USD', 'EUR', 'AED'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">RFQ Reference</Label>
                <Input value={form.rfqRef} onChange={e => setF('rfqRef', e.target.value)} placeholder="e.g. RFQ-2026-001" className="h-9" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Notes</Label>
                <Input value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Optional remarks or reference" className="h-9" />
              </div>
              {supplier && (
                <div className="col-span-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1.5">Supplier Intelligence</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[['Response Rate', '88%'], ['Avg Lead Time', '7 days'], ['YTD Spend', '£42k'], ['Rating', '4.2 ★']].map(([l, v]) => (
                      <div key={l}><p className="text-sm font-bold text-blue-700">{v}</p><p className="text-[10px] text-blue-500">{l}</p></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 – Items & Pricing */}
          {step === 'items' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Line Items & Pricing</h3>
                <Button size="sm" variant="outline" onClick={addRow} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />Add Item
                </Button>
              </div>
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="grid grid-cols-12 bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground gap-2">
                  <span className="col-span-4">Description</span>
                  <span className="col-span-1">Qty</span>
                  <span className="col-span-2">Unit</span>
                  <span className="col-span-2">Unit Price</span>
                  <span className="col-span-2">Tax %</span>
                  <span className="col-span-1" />
                </div>
                <div className="divide-y divide-border/40">
                  {rows.map((row, i) => {
                    const lineTotal = Number(row.unitPrice) * Number(row.quantity)
                    return (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5">
                        <Input value={row.description} onChange={e => updateRow(i, 'description', e.target.value)}
                          placeholder="Description" className="col-span-4 h-7 text-xs border-0 bg-muted/30 focus-visible:ring-0" />
                        <Input type="number" min="1" value={row.quantity} onChange={e => updateRow(i, 'quantity', e.target.value)}
                          className="col-span-1 h-7 text-xs border-0 bg-muted/30 focus-visible:ring-0" />
                        <Select value={row.uom} onValueChange={v => updateRow(i, 'uom', v)}>
                          <SelectTrigger className="col-span-2 h-7 text-xs border-0 bg-muted/30"><SelectValue /></SelectTrigger>
                          <SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" min="0" value={row.unitPrice} onChange={e => updateRow(i, 'unitPrice', e.target.value)}
                          className="col-span-2 h-7 text-xs border-0 bg-muted/30 focus-visible:ring-0" />
                        <Input type="number" min="0" max="100" value={row.taxRate} onChange={e => updateRow(i, 'taxRate', e.target.value)}
                          className="col-span-2 h-7 text-xs border-0 bg-muted/30 focus-visible:ring-0" />
                        <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                          className="col-span-1 flex items-center justify-center text-muted-foreground/30 hover:text-red-500 disabled:opacity-20 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {lineTotal > 0 && (
                          <p className="col-span-12 text-right text-[10px] text-muted-foreground pr-6">
                            Line total: <strong>{formatCurrency(lineTotal)}</strong>
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Cost summary */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="font-semibold text-foreground">{formatCurrency(tax)}</span></div>
                <div className="flex justify-between border-t border-border/50 pt-2 font-bold"><span>Grand Total</span><span className="text-blue-600 text-base">{formatCurrency(subtotal + tax)}</span></div>
              </div>
            </div>
          )}

          {/* Step 3 – Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Supplier', supplier?.name ?? '—'],
                  ['Quotation Date', form.quotationDate ? formatDate(form.quotationDate) : '—'],
                  ['Valid Until', form.validUntil ? formatDate(form.validUntil) : '—'],
                  ['Currency', form.currency],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</p>
                    <p className="text-sm font-semibold mt-1">{v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Items ({rows.filter(r => r.description.trim()).length})</div>
                {rows.filter(r => r.description.trim()).map((row, i) => (
                  <div key={i} className="flex items-center justify-between border-t border-border/30 px-4 py-2.5 text-sm">
                    <span>{row.description} <span className="text-xs text-muted-foreground">×{row.quantity} {row.uom}</span></span>
                    <span className="font-semibold">{formatCurrency(Number(row.unitPrice) * Number(row.quantity))}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border/50 bg-muted/30 px-4 py-2.5">
                  <span className="text-xs font-bold">Grand Total</span>
                  <span className="text-sm font-bold text-blue-600">{formatCurrency(subtotal + tax)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-border/60 bg-white px-6 py-4 flex items-center justify-between">
          <div className="flex gap-2">
            {step !== 'info' && <Button variant="outline" size="sm" onClick={() => setStep(step === 'review' ? 'items' : 'info')}>← Back</Button>}
            <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
          </div>
          {step === 'review' ? (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !infoValid || !itemsValid}>
              {mutation.isPending ? 'Saving…' : 'Save Quotation'}
            </Button>
          ) : (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setStep(step === 'info' ? 'items' : 'review')}
              disabled={step === 'info' && !infoValid}>
              Next →
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SupplierQuotationsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterValidity, setFilterValidity] = useState('ALL')

  const { data = [], isLoading } = useQuery({
    queryKey: ['sqs'],
    queryFn: () => api.get<SQ[]>('/api/procurement/supplier-quotations').then(r => r.data ?? []),
    staleTime: 30_000, refetchInterval: 60_000,
  })
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<Vendor[]>('/api/procurement/vendors').then(r => r.data ?? []),
  })

  const kpis = useMemo(() => ({
    received:   data.filter(s => s.status === 'RECEIVED').length,
    evaluation: data.filter(s => s.status === 'UNDER_REVIEW').length,
    awarded:    data.filter(s => s.status === 'ACCEPTED').length,
    rejected:   data.filter(s => s.status === 'REJECTED').length,
  }), [data])

  const filtered = useMemo(() => data.filter(sq => {
    const q = search.toLowerCase()
    const matchSearch = !search || sq.sqNumber.toLowerCase().includes(q) || sq.vendor.name.toLowerCase().includes(q) || (sq.rfq?.rfqNumber ?? '').toLowerCase().includes(q)
    const matchStatus = filterStatus === 'ALL' || sq.status === filterStatus
    const days = daysUntil(sq.validUntil)
    const matchValidity = filterValidity === 'ALL'
      || (filterValidity === 'VALID' && days >= 8)
      || (filterValidity === 'EXPIRING' && days >= 0 && days <= 7)
      || (filterValidity === 'EXPIRED' && days < 0)
    return matchSearch && matchStatus && matchValidity
  }), [data, search, filterStatus, filterValidity])

  const maxPrice = Math.max(...PRICE_COMP.map(s => s.price))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />Quotation Evaluation Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Supplier Quotations · {data.length} total</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-1.5 h-4 w-4" />Add Quotation
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: FileText,    label: 'Received',       value: kpis.received,   cls: 'text-blue-600',    bg: 'bg-blue-50' },
          { icon: Clock,       label: 'Under Evaluation',value: kpis.evaluation, cls: 'text-amber-600',   bg: 'bg-amber-50',   ring: kpis.evaluation > 0 },
          { icon: CheckCircle, label: 'Awarded',         value: kpis.awarded,   cls: 'text-emerald-600', bg: 'bg-emerald-50' },
          { icon: Star,        label: 'Avg Savings',     value: '8.2%',         cls: 'text-purple-600',  bg: 'bg-purple-50' },
        ].map(({ icon: Icon, label, value, cls, bg, ring }) => (
          <Card key={label} className={cn('border-border/60 shadow-sm', ring ? 'ring-1 ring-amber-200' : '')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg', bg)}>
                  <Icon className={cn('h-3.5 w-3.5', cls)} />
                </div>
              </div>
              <p className={cn('text-2xl font-bold', ring ? cls : '')}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Status distribution */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {STATUS_DIST.map(s => {
              const total = STATUS_DIST.reduce((a, b) => a + b.count, 0)
              const pct = (s.count / total) * 100
              return (
                <div key={s.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <span className="text-xs font-bold">{s.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', s.color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Price comparison */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />Price Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {PRICE_COMP.map((s, i) => {
              const pct = (s.price / maxPrice) * 100
              const isLowest = i === 0
              return (
                <div key={s.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium flex items-center gap-1">
                      {s.name}
                      {isLowest && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded px-1">Best</span>}
                    </span>
                    <span className={cn('text-xs font-bold', isLowest ? 'text-emerald-600' : '')}>{formatCurrency(s.price)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', isLowest ? 'bg-emerald-500' : 'bg-blue-400')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Evaluation scores */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />Evaluation Scores
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {EVAL_SCORES.map((s, i) => (
              <div key={s.name}>
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground/40 w-4">{i + 1}</span>
                    <span className="text-xs font-medium">{s.name}</span>
                  </div>
                  <span className={cn('text-xs font-bold', s.score >= 90 ? 'text-emerald-600' : s.score >= 80 ? 'text-amber-600' : 'text-red-500')}>{s.score}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full rounded-full', s.score >= 90 ? 'bg-emerald-500' : s.score >= 80 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${s.score}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search quotation number, supplier, RFQ…" className="pl-9 h-8 text-sm" />
        </div>
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
            {Object.entries(STATUS_CFG).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterValidity} onValueChange={setFilterValidity}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Validity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All</SelectItem>
            <SelectItem value="VALID" className="text-xs">Valid</SelectItem>
            <SelectItem value="EXPIRING" className="text-xs">Expiring Soon</SelectItem>
            <SelectItem value="EXPIRED" className="text-xs">Expired</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterStatus !== 'ALL' || filterValidity !== 'ALL') && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
            onClick={() => { setSearch(''); setFilterStatus('ALL'); setFilterValidity('ALL') }}>
            <X className="h-3 w-3 mr-1" />Clear
          </Button>
        )}
        {filtered.length !== data.length && <span className="text-xs text-muted-foreground">{filtered.length} of {data.length}</span>}
      </div>

      {/* Table */}
      <Card className="border-border/60 shadow-sm">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">{[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">{data.length === 0 ? 'No quotations yet.' : 'No quotations match the filters.'}</p>
              {data.length === 0 && <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setShowForm(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add Quotation</Button>}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  {['Quotation #', 'Supplier', 'RFQ Ref', 'Amount', 'Valid Until', 'PO', 'Status', ''].map(h => (
                    <th key={h} className={cn('px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70',
                      h === '' ? 'w-12' : 'text-left',
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map(sq => {
                  const days = daysUntil(sq.validUntil)
                  const expiring = days >= 0 && days <= 7
                  const expired  = days < 0
                  return (
                    <tr key={sq.id} className={cn('group hover:bg-muted/30 transition-colors', expired && sq.status !== 'ACCEPTED' ? 'bg-red-50/20' : '')}>
                      <td className="px-4 py-3">
                        <Link href={`/procurement/supplier-quotations/${sq.id}`} className="font-semibold text-blue-600 hover:text-blue-800">{sq.sqNumber}</Link>
                      </td>
                      <td className="px-4 py-3 font-medium">{sq.vendor.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sq.rfq?.rfqNumber ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(Number(sq.totalAmount))}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={cn(expired ? 'text-red-500 line-through' : '')}>{formatDate(sq.validUntil)}</span>
                          {expiring && <span className="text-[10px] font-semibold text-amber-600">{days}d left</span>}
                          {expired  && <span className="text-[10px] font-semibold text-red-500">Expired</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {sq.purchaseOrder ? (
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">{sq.purchaseOrder.poNumber}</span>
                        ) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusPill status={sq.status} /></td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                          <Link href={`/procurement/supplier-quotations/${sq.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <AddQuotationDialog open={showForm} onClose={() => setShowForm(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['sqs'] })} vendors={vendors} />
    </div>
  )
}
