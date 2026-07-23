'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
  Eye, Plus, ClipboardList, CheckSquare, Clock, X, Trash2,
  AlertCircle, TrendingUp, Send, Filter, Search, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type PR = {
  id: string; prNumber: string; status: string; priority: string
  requiredDate: string; totalAmount: number; department: string | null
  notes: string | null; createdAt: string
  vendor: { name: string } | null; _count: { rfqs: number }
}

type LineItem = { description: string; quantity: string; uom: string; estimatedUnitPrice: string }
type Form = { department: string; requiredDate: string; notes: string; priority: string; estimatedBudget: string; budgetCategory: string }

const PRIORITY_CONFIG: Record<string, { label: string; dotColor: string; textColor: string; bgColor: string }> = {
  LOW:    { label: 'Low',    dotColor: 'bg-gray-400',   textColor: 'text-gray-600',   bgColor: 'bg-gray-50 border-gray-200' },
  MEDIUM: { label: 'Medium', dotColor: 'bg-blue-500',   textColor: 'text-blue-700',   bgColor: 'bg-blue-50 border-blue-200' },
  HIGH:   { label: 'High',   dotColor: 'bg-amber-500',  textColor: 'text-amber-700',  bgColor: 'bg-amber-50 border-amber-200' },
  URGENT: { label: 'Urgent', dotColor: 'bg-red-500',    textColor: 'text-red-700',    bgColor: 'bg-red-50 border-red-200' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:      { label: 'Draft',      color: 'bg-gray-50 text-gray-600 border-gray-200' },
  PENDING:    { label: 'Pending',    color: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED:   { label: 'Approved',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED:   { label: 'Rejected',   color: 'bg-red-50 text-red-600 border-red-200' },
  PO_CREATED: { label: 'PO Created', color: 'bg-blue-50 text-blue-700 border-blue-200' },
}

const DEPARTMENTS = ['IT', 'HR', 'Finance', 'Operations', 'Sales', 'Marketing', 'Warehouse', 'Manufacturing', 'Admin']
const BUDGET_CATEGORIES = ['Capital Expenditure', 'Operating Expense', 'IT & Technology', 'Office Supplies', 'Maintenance', 'Travel', 'Training', 'Other']
const UOM_OPTIONS = ['EA', 'PCS', 'BOX', 'SET', 'KG', 'LTR', 'MTR', 'ROLL', 'PACK']
const APPROVAL_CHAIN = ['Employee', 'Department Manager', 'Procurement Manager', 'Finance Manager']
const WORKFLOW_STEPS = ['Need', 'Draft', 'Submitted', 'Manager', 'Procurement', 'RFQ']

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority]
  if (!cfg) return <span className="text-xs text-muted-foreground">{priority}</span>
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold', cfg.bgColor, cfg.textColor)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotColor)} />
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return <span className="text-xs text-muted-foreground">{status}</span>
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', cfg.color)}>
      {cfg.label}
    </span>
  )
}

function WorkflowBar({ currentStatus }: { currentStatus: string }) {
  const activeIdx = currentStatus === 'DRAFT' ? 1 : currentStatus === 'PENDING' ? 2 : currentStatus === 'APPROVED' ? 3 : currentStatus === 'PO_CREATED' ? 5 : 1
  return (
    <div className="flex items-center gap-0">
      {WORKFLOW_STEPS.map((step, i) => {
        const done = i < activeIdx
        const active = i === activeIdx
        return (
          <div key={step} className="flex items-center">
            <div className={cn(
              'flex h-6 items-center rounded-full px-2.5 text-[10px] font-semibold transition-all',
              done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground/50',
            )}>
              {done && <span className="mr-1 text-[9px]">✓</span>}{step}
            </div>
            {i < WORKFLOW_STEPS.length - 1 && (
              <ChevronRight className={cn('h-3 w-3 mx-0.5', done ? 'text-emerald-400' : 'text-muted-foreground/20')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function NewPRDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const qc = useQueryClient()
  const [step, setStep] = useState<'info' | 'items' | 'review'>('info')
  const [form, setForm] = useState<Form>({ department: '', requiredDate: '', notes: '', priority: 'MEDIUM', estimatedBudget: '', budgetCategory: '' })
  const [rows, setRows] = useState<LineItem[]>([{ description: '', quantity: '1', uom: 'EA', estimatedUnitPrice: '0' }])

  const subtotal = rows.reduce((s, r) => s + Number(r.quantity) * Number(r.estimatedUnitPrice), 0)
  const taxEst = subtotal * 0.05
  const grandTotal = subtotal + taxEst
  const budget = Number(form.estimatedBudget) || 0
  const remaining = budget - grandTotal
  const budgetPct = budget > 0 ? Math.min((grandTotal / budget) * 100, 100) : 0

  const addRow = () => setRows(p => [...p, { description: '', quantity: '1', uom: 'EA', estimatedUnitPrice: '0' }])
  const removeRow = (i: number) => setRows(p => p.filter((_, j) => j !== i))
  const updateRow = (i: number, k: keyof LineItem, v: string) => setRows(p => p.map((r, j) => j === i ? { ...r, [k]: v } : r))
  const setF = (k: keyof Form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const createMutation = useMutation({
    mutationFn: (submit: boolean) => api.post('/api/procurement/purchase-requests', {
      requestedById: 'system',
      department: form.department,
      requiredDate: form.requiredDate,
      notes: form.notes,
      priority: form.priority,
      submitForApproval: submit,
      lineItems: rows.filter(r => r.description).map(r => ({
        description: r.description, quantity: Number(r.quantity),
        uom: r.uom, estimatedUnitPrice: Number(r.estimatedUnitPrice),
      })),
    }),
    onMutate: async (submit) => {
      await qc.cancelQueries({ queryKey: ['prs'] })
      const previous = qc.getQueryData(['prs'])
      qc.setQueryData(['prs'], (old: any[]) => [{ id: 'temp-' + Date.now(), prNumber: '...', status: submit ? 'PENDING' : 'DRAFT', priority: form.priority, requiredDate: form.requiredDate, department: form.department, notes: form.notes, totalAmount: 0, createdAt: new Date().toISOString(), vendor: null, _count: { rfqs: 0 } }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: (_, submit) => { toast.success(submit ? 'PR submitted for approval' : 'Draft saved') },
    onError: (err, submit, context) => { if (context?.previous) qc.setQueryData(['prs'], context.previous); toast.error('Failed to create PR') },
    onSettled: () => { onSuccess(); handleClose() },
  })

  function handleClose() {
    setStep('info')
    setForm({ department: '', requiredDate: '', notes: '', priority: 'MEDIUM', estimatedBudget: '', budgetCategory: '' })
    setRows([{ description: '', quantity: '1', uom: 'EA', estimatedUnitPrice: '0' }])
    onClose()
  }

  const infoValid = !!form.requiredDate && !!form.department
  const itemsValid = rows.some(r => r.description.trim())

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 border-b bg-white px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold">New Purchase Request</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Fill in the details below to request items for procurement.</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {(['info', 'items', 'review'] as const).map((s, i) => {
              const labels = ['Request Info', 'Items', 'Review & Submit']
              const done = step === 'items' ? i < 1 : step === 'review' ? i < 2 : false
              const active = step === s
              return (
                <div key={s} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => (done || active) && setStep(s)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all',
                      active ? 'bg-indigo-600 text-white' : done ? 'bg-emerald-100 text-emerald-700 cursor-pointer' : 'bg-muted text-muted-foreground/50',
                    )}
                  >
                    {done ? '✓ ' : `${i + 1}. `}{labels[i]}
                  </button>
                  {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground/30" />}
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {step === 'info' && (
            <>
              <div>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-indigo-500" />
                  Request Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Department <span className="text-red-500">*</span></Label>
                    <Select value={form.department} onValueChange={v => setF('department', v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Required By <span className="text-red-500">*</span></Label>
                    <Input type="date" value={form.requiredDate} onChange={e => setF('requiredDate', e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Priority</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setF('priority', key)}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-lg border py-2 px-1 transition-all text-[10px] font-semibold',
                            form.priority === key ? `${cfg.bgColor} ${cfg.textColor} ring-1 ring-current` : 'border-border/60 text-muted-foreground hover:border-border',
                          )}
                        >
                          <span className={cn('h-2 w-2 rounded-full', cfg.dotColor)} />
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Budget Category</Label>
                    <Select value={form.budgetCategory} onValueChange={v => setF('budgetCategory', v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUDGET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Estimated Budget</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>
                      <Input type="number" min="0" step="100" value={form.estimatedBudget} onChange={e => setF('estimatedBudget', e.target.value)} className="h-9 pl-6" placeholder="0.00" />
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold">Purpose / Justification <span className="text-red-500">*</span></Label>
                    <Textarea value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="e.g. Need 10 laptops for new development team joining next month." className="min-h-[80px] resize-none text-sm" />
                    <p className={cn('text-[10px]', form.notes.length < 20 ? 'text-muted-foreground/50' : 'text-emerald-500')}>{form.notes.length}/20 characters minimum</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 mb-3">Approval Route After Submission</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {APPROVAL_CHAIN.map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg bg-white border border-indigo-100 px-3 py-1.5">
                        <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600">{i + 1}</div>
                        <span className="text-xs text-foreground">{step}</span>
                      </div>
                      {i < APPROVAL_CHAIN.length - 1 && <ChevronRight className="h-3 w-3 text-indigo-300 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 'items' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-indigo-500" />
                  Requested Items
                </h3>
                <Button size="sm" variant="outline" onClick={addRow} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />Add Item
                </Button>
              </div>
              <div className="rounded-xl border overflow-hidden">
                <div className="grid grid-cols-12 gap-2 bg-muted/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="col-span-4">Description</span>
                  <span className="col-span-2">Qty</span>
                  <span className="col-span-2">Unit</span>
                  <span className="col-span-2">Est. Price</span>
                  <span className="col-span-1 text-right">Total</span>
                  <span className="col-span-1" />
                </div>
                <div className="divide-y divide-border/40">
                  {rows.map((row, i) => {
                    const lineTotal = Number(row.quantity) * Number(row.estimatedUnitPrice)
                    return (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5">
                        <Input placeholder="e.g. Dell Laptop 15 inch" value={row.description} onChange={e => updateRow(i, 'description', e.target.value)} className="col-span-4 h-8 text-xs border-0 bg-muted/30 focus:bg-white focus:border focus:border-border" />
                        <Input type="number" min="1" value={row.quantity} onChange={e => updateRow(i, 'quantity', e.target.value)} className="col-span-2 h-8 text-xs border-0 bg-muted/30 focus:bg-white focus:border focus:border-border" />
                        <Select value={row.uom} onValueChange={v => updateRow(i, 'uom', v)}>
                          <SelectTrigger className="col-span-2 h-8 text-xs border-0 bg-muted/30"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UOM_OPTIONS.map(u => <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input type="number" min="0" step="0.01" value={row.estimatedUnitPrice} onChange={e => updateRow(i, 'estimatedUnitPrice', e.target.value)} className="col-span-2 h-8 text-xs border-0 bg-muted/30 focus:bg-white focus:border focus:border-border" />
                        <span className="col-span-1 text-right text-xs font-semibold">{lineTotal > 0 ? formatCurrency(lineTotal) : '—'}</span>
                        <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1} className="col-span-1 flex items-center justify-center text-muted-foreground/40 hover:text-red-500 disabled:opacity-20 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tax Estimate (5%)</span><span className="font-medium">{formatCurrency(taxEst)}</span></div>
                    <div className="flex justify-between text-sm border-t pt-2 mt-1"><span className="font-semibold">Grand Total</span><span className="font-bold text-indigo-600">{formatCurrency(grandTotal)}</span></div>
                  </div>
                  {budget > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Budget Utilization</p>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', budgetPct > 90 ? 'bg-red-500' : budgetPct > 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${budgetPct}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground"><span>Requested: {formatCurrency(grandTotal)}</span><span>Available: {formatCurrency(Math.max(remaining, 0))}</span></div>
                      <p className={cn('text-xs font-semibold', remaining < 0 ? 'text-red-600' : 'text-emerald-600')}>{remaining < 0 ? `Over budget by ${formatCurrency(Math.abs(remaining))}` : `${formatCurrency(remaining)} remaining`}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2"><CheckSquare className="h-4 w-4 text-indigo-500" />Review & Submit</h3>
              <div className="grid grid-cols-4 gap-3">
                {[ { label: 'Department', value: form.department || '—' }, { label: 'Required By', value: form.requiredDate ? formatDate(form.requiredDate) : '—' }, { label: 'Priority', value: PRIORITY_CONFIG[form.priority]?.label ?? form.priority }, { label: 'Items', value: `${rows.filter(r => r.description).length} item(s)` } ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border bg-muted/20 p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p><p className="text-sm font-semibold mt-1">{value}</p></div>
                ))}
              </div>
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Requested Items</div>
                <div className="divide-y divide-border/40">
                  {rows.filter(r => r.description).map((row, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div><p className="font-medium">{row.description}</p><p className="text-xs text-muted-foreground">{row.quantity} {row.uom}</p></div>
                      <p className="font-semibold">{formatCurrency(Number(row.quantity) * Number(row.estimatedUnitPrice))}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between px-4 py-3 bg-muted/20 border-t text-sm font-bold"><span>Grand Total (incl. 5% tax est.)</span><span className="text-indigo-600">{formatCurrency(grandTotal)}</span></div>
              </div>
              {form.notes && (
                <div className="rounded-lg border bg-muted/20 p-4"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Purpose</p><p className="text-sm text-foreground">{form.notes}</p></div>
              )}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 mb-3">Approval Chain</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {APPROVAL_CHAIN.map((person, i) => (
                    <div key={person} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg bg-white border border-indigo-100 px-3 py-1.5">
                        <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600">{i + 1}</div>
                        <span className="text-xs">{person}</span>
                      </div>
                      {i < APPROVAL_CHAIN.length - 1 && <ChevronRight className="h-3 w-3 text-indigo-300 shrink-0" />}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-indigo-500 mt-2">Expected procurement time: 5–7 business days</p>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t bg-white px-6 py-4 flex items-center justify-between">
          <div className="flex gap-2">
            {step !== 'info' && <Button variant="outline" size="sm" onClick={() => setStep(step === 'review' ? 'items' : 'info')}>← Back</Button>}
            <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
          </div>
          <div className="flex gap-2">
            {step === 'review' ? (
              <>
                <Button variant="outline" size="sm" onClick={() => createMutation.mutate(false)} disabled={createMutation.isPending || !infoValid || !itemsValid}>{createMutation.isPending ? 'Saving…' : 'Save as Draft'}</Button>
                <Button size="sm" onClick={() => createMutation.mutate(true)} disabled={createMutation.isPending || !infoValid || !itemsValid} className="bg-indigo-600 hover:bg-indigo-700"><Send className="mr-1.5 h-3.5 w-3.5" />{createMutation.isPending ? 'Submitting…' : 'Submit for Approval'}</Button>
              </>
            ) : (
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setStep(step === 'info' ? 'items' : 'review')} disabled={step === 'info' && !infoValid}>Next →</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PageClient({ initialData }: { initialData: PR[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterPriority, setFilterPriority] = useState('ALL')

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['prs'],
    queryFn: () => api.get<PR[]>('/api/procurement/purchase-requests').then(r => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })

  const filtered = useMemo(() => {
    return data.filter(pr => {
      const matchSearch = !search || pr.prNumber.toLowerCase().includes(search.toLowerCase()) || (pr.department ?? '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'ALL' || pr.status === filterStatus
      const matchPriority = filterPriority === 'ALL' || pr.priority === filterPriority
      return matchSearch && matchStatus && matchPriority
    })
  }, [data, search, filterStatus, filterPriority])

  const kpis = useMemo(() => ({
    total: data.length,
    pending: data.filter(p => p.status === 'PENDING').length,
    approved: data.filter(p => p.status === 'APPROVED').length,
    draft: data.filter(p => p.status === 'DRAFT').length,
    totalValue: data.reduce((s, p) => s + Number(p.totalAmount), 0),
  }), [data])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-purple-600" />
            Purchase Requests
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Internal purchase requisitions · {data.length} total</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="mr-1.5 h-4 w-4" />New Request
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[ { label: 'Total PRs', value: kpis.total, icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-50' }, { label: 'Pending Approval', value: kpis.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', highlight: kpis.pending > 0 }, { label: 'Approved', value: kpis.approved, icon: CheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-50' }, { label: 'Drafts', value: kpis.draft, icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-50' }, { label: 'Total Value', value: formatCurrency(kpis.totalValue), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' }, ].map(({ label, value, icon: Icon, color, bg, highlight }) => (
          <Card key={label} className={cn(', highlight ? 'ring-1 ring-amber-200' : '')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg', bg)}><Icon className={cn('h-3.5 w-3.5', color)} /></div>
              </div>
              <p className={cn('text-xl font-bold', highlight ? 'text-amber-600' : '')}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PR number or department…" className="pl-9 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Priorities</SelectItem>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {(search || filterStatus !== 'ALL' || filterPriority !== 'ALL') && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setSearch(''); setFilterStatus('ALL'); setFilterPriority('ALL') }}>
              <X className="h-3 w-3 mr-1" />Clear
            </Button>
          )}
        </div>
        {filtered.length !== data.length && (
          <span className="text-xs text-muted-foreground">{filtered.length} of {data.length} shown</span>
        )}
      </div>

      <DataTable
        columns={[
          { key: 'prNumber', header: 'PR Number', sortable: true, render: (row: PR) => (
            <div><Link href={`/procurement/purchase-requests/${row.id}`} className="font-semibold text-blue-600 hover:text-blue-800 text-sm">{row.prNumber}</Link><p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(row.createdAt)}</p></div>
          )},
          { key: 'department', header: 'Department', render: (row: PR) => <span className="text-sm">{row.department ?? '—'}</span> },
          { key: 'priority', header: 'Priority', render: (row: PR) => <PriorityBadge priority={row.priority} /> },
          { key: 'requiredDate', header: 'Required By', sortable: true, render: (row: PR) => {
            const overdue = row.status !== 'APPROVED' && row.status !== 'REJECTED' && row.status !== 'PO_CREATED' && new Date(row.requiredDate) < new Date()
            return <span className={cn('text-sm', overdue ? 'text-red-600 font-semibold' : '')}>{formatDate(row.requiredDate)}{overdue && <span className="ml-1 text-[9px] font-bold bg-red-100 text-red-600 px-1 rounded">OVERDUE</span>}</span>
          }},
          { key: 'totalAmount', header: 'Est. Amount', sortable: true, render: (row: PR) => <span className="text-sm font-semibold">{formatCurrency(Number(row.totalAmount))}</span> },
          { key: 'status', header: 'Status', render: (row: PR) => <StatusBadge status={row.status} /> },
          { key: 'workflow', header: 'Pipeline', render: (row: PR) => <WorkflowBar currentStatus={row.status} /> },
        ]}
        data={filtered}
        isLoading={isLoading} error={error}
        actions={(row: PR) => (
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href={`/procurement/purchase-requests/${row.id}`}><Eye className="h-3.5 w-3.5" /></Link>
          </Button>
        )}
      />

      <NewPRDialog open={showForm} onClose={() => setShowForm(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ['prs'] })} />
    </div>
  )
}
