'use client'
import { useState, useMemo, useEffect, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import { formatDate, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Eye, Plus, FileSearch, Clock, CheckCircle, AlertTriangle,
  TrendingUp, Search, Filter, X, ChevronRight, Send, Trash2, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type RFQ = {
  id: string; rfqNumber: string; status: string; rfqDate: string; dueDate: string; notes: string | null
  vendor: { name: string }; pr: { prNumber: string } | null
  _count: { quotations: number; lineItems: number }
}
type Vendor = { id: string; name: string }
type PRLineItem = { description: string; quantity: number | string; uom: string }
type PRDetail = { id: string; prNumber: string; lineItems: PRLineItem[] }

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: 'Draft',     cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  SENT:      { label: 'Sent',      cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  CLOSED:    { label: 'Closed',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-50 text-red-600 border-red-200' },
}

const UOM_OPTIONS = ['EA', 'PCS', 'BOX', 'SET', 'KG', 'LTR', 'MTR', 'ROLL', 'PACK']

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', cfg?.cls ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
      {cfg?.label ?? status}
    </span>
  )
}

// ── New RFQ Wizard ─────────────────────────────────────────────────────────────
function NewRFQDialog({ open, onClose, onSuccess, vendors, sourcePr }: {
  open: boolean; onClose: () => void; onSuccess: () => void; vendors: Vendor[]; sourcePr?: PRDetail
}) {
  const qc = useQueryClient()
  const [step, setStep] = useState<'info' | 'items' | 'review'>('info')
  const [form, setForm] = useState({ vendorId: '', title: '', dueDate: '', notes: '', currency: 'GBP' })
  const [rows, setRows] = useState([{ description: '', quantity: '1', uom: 'EA' }])

  // Pre-fill title and line items from the source purchase request, if opened from one
  useEffect(() => {
    if (open && sourcePr) {
      setForm(p => ({ ...p, title: p.title || `Sourcing for ${sourcePr.prNumber}` }))
      if (sourcePr.lineItems.length > 0) {
        setRows(sourcePr.lineItems.map(li => ({ description: li.description, quantity: String(li.quantity), uom: li.uom })))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourcePr])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const addRow = () => setRows(p => [...p, { description: '', quantity: '1', uom: 'EA' }])
  const removeRow = (i: number) => setRows(p => p.filter((_, j) => j !== i))
  const updateRow = (i: number, k: string, v: string) => setRows(p => p.map((r, j) => j === i ? { ...r, [k]: v } : r))

  const mutation = useMutation({
    mutationFn: () => api.post('/api/procurement/rfqs', {
      vendorId: form.vendorId,
      prId: sourcePr?.id,
      rfqDate: new Date().toISOString().split('T')[0],
      dueDate: form.dueDate,
      notes: [form.title, form.notes].filter(Boolean).join('\n'),
      lineItems: rows.filter(r => r.description.trim()).map(r => ({
        description: r.description, quantity: Number(r.quantity), uom: r.uom,
      })),
    }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['rfqs'] })
      const previous = qc.getQueryData(['rfqs'])
      const vendor = vendors.find(v => v.id === form.vendorId)
      qc.setQueryData(['rfqs'], (old: any[]) => [{ id: 'temp-' + Date.now(), rfqNumber: '...', status: 'DRAFT', rfqDate: new Date().toISOString().split('T')[0], dueDate: form.dueDate, notes: [form.title, form.notes].filter(Boolean).join('\n'), vendor: { name: vendor?.name ?? '' }, pr: sourcePr ? { prNumber: sourcePr.prNumber } : null, _count: { quotations: 0, lineItems: rows.filter(r => r.description.trim()).length } }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('RFQ created') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['rfqs'], context.previous); toast.error('Failed to create RFQ') },
    onSettled: () => { onSuccess(); handleClose() },
  })

  function handleClose() {
    setStep('info')
    setForm({ vendorId: '', title: '', dueDate: '', notes: '', currency: 'GBP' })
    setRows([{ description: '', quantity: '1', uom: 'EA' }])
    onClose()
  }

  const supplier = vendors.find(v => v.id === form.vendorId)
  const infoValid = !!form.vendorId && !!form.dueDate
  const itemsValid = rows.some(r => r.description.trim())
  const STEPS = [
    { key: 'info' as const,   order: 0, label: 'General Info' },
    { key: 'items' as const,  order: 1, label: 'Items' },
    { key: 'review' as const, order: 2, label: 'Review & Send' },
  ]
  const currentOrder = STEPS.find(s => s.key === step)!.order

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Sticky wizard header */}
        <div className="sticky top-0 z-10 border-b bg-white px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold">New Request for Quotation</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sourcePr ? <>Sourcing for approved requisition <span className="font-semibold text-blue-600">{sourcePr.prNumber}</span></> : 'Invite suppliers to quote for your requirements'}
              </p>
            </div>
            <button type="button" onClick={handleClose} className="text-muted-foreground/40 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => {
              const done = s.order < currentOrder
              const active = s.key === step
              return (
                <div key={s.key} className="flex items-center gap-1.5">
                  <button type="button"
                    onClick={() => (done || active) && setStep(s.key)}
                    className={cn(
                      'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all',
                      active ? 'bg-blue-600 text-white'
                        : done ? 'bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200'
                        : 'bg-muted text-muted-foreground/40',
                    )}>
                    {done ? '✓ ' : `${i + 1}. `}{s.label}
                  </button>
                  {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 min-h-[300px]">
          {/* Step 1 – General Info */}
          {step === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">RFQ Title <span className="text-red-500">*</span></Label>
                  <Input value={form.title} onChange={e => setF('title', e.target.value)}
                    placeholder="e.g. Supply of 20 Laptops – IT Department" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Supplier <span className="text-red-500">*</span></Label>
                  <Select value={form.vendorId} onValueChange={v => setF('vendorId', v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Currency</Label>
                  <Select value={form.currency} onValueChange={v => setF('currency', v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['GBP', 'USD', 'EUR', 'AED'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">Closing Date <span className="text-red-500">*</span></Label>
                  <Input type="date" value={form.dueDate} onChange={e => setF('dueDate', e.target.value)} className="h-9" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">Description / Scope</Label>
                  <Textarea value={form.notes} onChange={e => setF('notes', e.target.value)}
                    placeholder="Detailed requirements, specifications, or scope of work…"
                    className="min-h-[80px] resize-none text-sm" />
                </div>
              </div>
              {supplier && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500 mb-2">
                    Supplier Intelligence · {supplier.name}
                  </p>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    {[['Response Rate', '88%'], ['Avg Lead Time', '7 days'], ['YTD Spend', '£42k'], ['Rating', '4.2 ★']].map(([l, v]) => (
                      <div key={l}>
                        <p className="text-sm font-bold text-blue-700">{v}</p>
                        <p className="text-[10px] text-blue-500">{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 – Items */}
          {step === 'items' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Items Required</h3>
                <Button size="sm" variant="outline" onClick={addRow} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />Add Item
                </Button>
              </div>
              <div className="rounded-xl border overflow-hidden">
                <div className="grid grid-cols-12 gap-2 bg-muted/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="col-span-7">Description</span>
                  <span className="col-span-2">Qty</span>
                  <span className="col-span-2">Unit</span>
                  <span className="col-span-1" />
                </div>
                <div className="divide-y divide-border/40">
                  {rows.map((row, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5">
                      <Input value={row.description} onChange={e => updateRow(i, 'description', e.target.value)}
                        placeholder="Item description"
                        className="col-span-7 h-8 text-xs border-0 bg-muted/30 focus-visible:ring-0" />
                      <Input type="number" min="1" value={row.quantity} onChange={e => updateRow(i, 'quantity', e.target.value)}
                        className="col-span-2 h-8 text-xs border-0 bg-muted/30 focus-visible:ring-0" />
                      <Select value={row.uom} onValueChange={v => updateRow(i, 'uom', v)}>
                        <SelectTrigger className="col-span-2 h-8 text-xs border-0 bg-muted/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UOM_OPTIONS.map(u => <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                        className="col-span-1 flex items-center justify-center text-muted-foreground/30 hover:text-red-500 disabled:opacity-20 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/50">{rows.filter(r => r.description.trim()).length} item(s) defined</p>
            </div>
          )}

          {/* Step 3 – Review & Send */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Supplier', supplier?.name ?? '—'],
                  ['Closing Date', form.dueDate ? formatDate(form.dueDate) : '—'],
                  ['Items', `${rows.filter(r => r.description.trim()).length} line item(s)`],
                  ['Currency', form.currency],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</p>
                    <p className="text-sm font-semibold mt-1">{v}</p>
                  </div>
                ))}
              </div>
              {form.title && (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Title</p>
                  <p className="text-sm">{form.title}</p>
                </div>
              )}
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Items</div>
                {rows.filter(r => r.description.trim()).map((row, i) => (
                  <div key={i} className="flex items-center justify-between border-t border-border/30 px-4 py-2.5 text-sm">
                    <span>{row.description}</span>
                    <span className="text-xs text-muted-foreground">{row.quantity} {row.uom}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                <p className="text-xs text-blue-700">
                  This RFQ will be sent to <strong>{supplier?.name}</strong>. They will be notified to submit their quotation before{' '}
                  <strong>{form.dueDate ? formatDate(form.dueDate) : '—'}</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 border-t bg-white px-6 py-4 flex items-center justify-between">
          <div className="flex gap-2">
            {step !== 'info' && (
              <Button variant="outline" size="sm" onClick={() => setStep(step === 'review' ? 'items' : 'info')}>← Back</Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
          </div>
          {step === 'review' ? (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !infoValid || !itemsValid}>
              <Send className="mr-1.5 h-3.5 w-3.5" />{mutation.isPending ? 'Creating…' : 'Create & Send RFQ'}
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
function RFQsPageContent() {
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const prId = searchParams.get('prId')
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterResponse, setFilterResponse] = useState('ALL')

  const { data = [], isLoading } = useQuery({
    queryKey: ['rfqs'],
    queryFn: () => api.get<RFQ[]>('/api/procurement/rfqs').then(r => r.data ?? []),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<Vendor[]>('/api/procurement/vendors').then(r => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })
  const { data: sourcePr } = useQuery({
    queryKey: ['pr-for-rfq', prId],
    queryFn: () => api.get<PRDetail>(`/api/procurement/purchase-requests/${prId}`).then(r => r.data!),
    enabled: !!prId,
  })

  // Coming from an approved PR's "Create RFQ" action — open the wizard automatically
  useEffect(() => {
    if (prId) setShowForm(true)
  }, [prId])

  const kpis = useMemo(() => ({
    active:    data.filter(r => !['CANCELLED', 'CLOSED'].includes(r.status)).length,
    waiting:   data.filter(r => r.status === 'SENT' && r._count.quotations === 0).length,
    responses: data.reduce((s, r) => s + r._count.quotations, 0),
    overdue:   data.filter(r => r.status === 'SENT' && daysUntil(r.dueDate) < 0).length,
  }), [data])

  const pipeline = useMemo(() => {
    const draft     = data.filter(r => r.status === 'DRAFT').length
    const sent      = data.filter(r => r.status === 'SENT' || r.status === 'CLOSED').length
    const responded = data.filter(r => r._count.quotations > 0).length
    const closed    = data.filter(r => r.status === 'CLOSED').length
    return [
      { stage: 'Draft',      count: draft,     color: '#6b7280' },
      { stage: 'Sent',       count: sent,      color: '#3b82f6' },
      { stage: 'Responses',  count: responded, color: '#8b5cf6' },
      { stage: 'Closed',     count: closed,    color: '#10b981' },
    ]
  }, [data])
  const pipelineMax = Math.max(...pipeline.map(s => s.count), 1)

  const supplierRates = useMemo(() => {
    const map: Record<string, { sent: number; responded: number }> = {}
    for (const r of data) {
      if (r.status === 'DRAFT') continue
      if (!map[r.vendor.name]) map[r.vendor.name] = { sent: 0, responded: 0 }
      map[r.vendor.name].sent++
      if (r._count.quotations > 0) map[r.vendor.name].responded++
    }
    return Object.entries(map)
      .map(([name, s]) => ({ name, sent: s.sent, rate: s.sent > 0 ? Math.round((s.responded / s.sent) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5)
  }, [data])

  const filtered = useMemo(() => data.filter(rfq => {
    const q = search.toLowerCase()
    return (
      (!search || rfq.rfqNumber.toLowerCase().includes(q) || rfq.vendor.name.toLowerCase().includes(q) || (rfq.pr?.prNumber ?? '').toLowerCase().includes(q)) &&
      (filterStatus === 'ALL' || rfq.status === filterStatus) &&
      (filterResponse === 'ALL' || (filterResponse === 'WITH' ? rfq._count.quotations > 0 : rfq._count.quotations === 0))
    )
  }), [data, search, filterStatus, filterResponse])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-blue-600" />Supplier Sourcing Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Request for Quotation · {data.length} total</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-1.5 h-4 w-4" />New RFQ
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: FileSearch,    label: 'Active RFQs',        value: kpis.active,    cls: 'text-blue-600',    bg: 'bg-blue-50' },
          { icon: Clock,         label: 'Awaiting Response',   value: kpis.waiting,   cls: 'text-amber-600',   bg: 'bg-amber-50',   ring: kpis.waiting > 0 },
          { icon: CheckCircle,   label: 'Responses Received',  value: kpis.responses, cls: 'text-emerald-600', bg: 'bg-emerald-50' },
          { icon: AlertTriangle, label: 'Overdue RFQs',        value: kpis.overdue,   cls: 'text-red-600',     bg: 'bg-red-50',     ring: kpis.overdue > 0 },
        ].map(({ icon: Icon, label, value, cls, bg, ring }) => (
          <Card key={label} className={cn(ring ? 'ring-1 ring-amber-200' : '')}>
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

      {/* Pipeline + Supplier Response Rate */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />RFQ Pipeline
              </CardTitle>
              <span className="text-xs text-muted-foreground">Active sourcing stages</span>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-2.5">
            {data.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No RFQs yet.</p>
            ) : pipeline.map((s, i) => {
              const pct = Math.max(4, (s.count / pipelineMax) * 100)
              const drop = i > 0 ? pipeline[i - 1].count - s.count : 0
              return (
                <div key={s.stage} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{s.stage}</span>
                  <div className="flex-1 h-7 rounded-lg bg-muted/50 overflow-hidden">
                    <div className="h-full rounded-lg flex items-center" style={{ width: `${pct}%`, backgroundColor: s.color }}>
                      <span className="px-2 text-[11px] font-bold text-white">{s.count}</span>
                    </div>
                  </div>
                  <span className="w-8 shrink-0 text-[10px] text-muted-foreground/50 text-right">{drop > 0 ? `-${drop}` : ''}</span>
                </div>
              )
            })}
            <div className="flex gap-5 pt-3 mt-1 border-t border-border/40">
              <div>
                <p className="text-lg font-bold">{data.length}</p>
                <p className="text-[10px] text-muted-foreground">In Pipeline</p>
              </div>
              <div className="border-l border-border/40 pl-4">
                <p className="text-lg font-bold text-emerald-600">{pipeline[3].count}</p>
                <p className="text-[10px] text-muted-foreground">Closed</p>
              </div>
              <div className="border-l border-border/40 pl-4">
                <p className="text-lg font-bold">{data.length > 0 ? ((pipeline[3].count / data.length) * 100).toFixed(0) : 0}%</p>
                <p className="text-[10px] text-muted-foreground">Close Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card >
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />Supplier Response Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {supplierRates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No RFQs sent to suppliers yet.</p>
            ) : supplierRates.map((s, i) => (
              <div key={s.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground/40 w-4 shrink-0">{i + 1}</span>
                    <span className="text-xs font-medium truncate">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">({s.sent} sent)</span>
                  </div>
                  <span className={cn('text-xs font-bold ml-2 shrink-0',
                    s.rate >= 90 ? 'text-emerald-600' : s.rate >= 75 ? 'text-amber-600' : 'text-red-500',
                  )}>{s.rate}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', s.rate >= 90 ? 'bg-emerald-500' : s.rate >= 75 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${s.rate}%` }}
                  />
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
            placeholder="Search RFQ number, supplier, PR reference…" className="pl-9 h-8 text-sm" />
        </div>
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterResponse} onValueChange={setFilterResponse}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Response" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All</SelectItem>
            <SelectItem value="WITH" className="text-xs">Has Responses</SelectItem>
            <SelectItem value="WITHOUT" className="text-xs">No Response</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterStatus !== 'ALL' || filterResponse !== 'ALL') && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
            onClick={() => { setSearch(''); setFilterStatus('ALL'); setFilterResponse('ALL') }}>
            <X className="h-3 w-3 mr-1" />Clear
          </Button>
        )}
        {filtered.length !== data.length && (
          <span className="text-xs text-muted-foreground">{filtered.length} of {data.length}</span>
        )}
      </div>

      {/* RFQ Table */}
      <Card >
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <FileSearch className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                {data.length === 0 ? 'No RFQs yet. Create your first RFQ.' : 'No RFQs match the current filters.'}
              </p>
              {data.length === 0 && (
                <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setShowForm(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />New RFQ
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  {['RFQ Number', 'Supplier', 'PR Ref', 'Closing Date', 'Days Left', 'Responses', 'Status', ''].map(h => (
                    <th key={h} className={cn(
                      'px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70',
                      h === 'Responses' || h === 'Days Left' ? 'text-center' : h === '' ? 'w-12' : 'text-left',
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map(rfq => {
                  const days = daysUntil(rfq.dueDate)
                  const overdue = rfq.status === 'SENT' && days < 0
                  return (
                    <tr key={rfq.id} className={cn('group transition-colors hover:bg-muted/30', overdue ? 'bg-red-50/30' : '')}>
                      <td className="px-4 py-3">
                        <Link href={`/procurement/rfqs/${rfq.id}`} className="font-semibold text-blue-600 hover:text-blue-800">
                          {rfq.rfqNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium">{rfq.vendor.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{rfq.pr?.prNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(rfq.dueDate)}</td>
                      <td className="px-4 py-3 text-center">
                        {rfq.status === 'SENT' ? (
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            overdue ? 'bg-red-100 text-red-600'
                              : days <= 2 ? 'bg-amber-100 text-amber-700'
                              : 'bg-muted text-muted-foreground',
                          )}>
                            {overdue ? `${Math.abs(days)}d overdue` : `${days}d`}
                          </span>
                        ) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('text-[11px] font-bold', rfq._count.quotations > 0 ? 'text-emerald-600' : 'text-muted-foreground/30')}>
                          {rfq._count.quotations > 0 ? rfq._count.quotations : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusPill status={rfq.status} /></td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                          <Link href={`/procurement/rfqs/${rfq.id}`}><Eye className="h-3.5 w-3.5" /></Link>
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

      <NewRFQDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['rfqs'] })}
        vendors={vendors}
        sourcePr={sourcePr}
      />
    </div>
  )
}

export default function RFQsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <RFQsPageContent />
    </Suspense>
  )
}
