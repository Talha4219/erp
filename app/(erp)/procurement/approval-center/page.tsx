'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CheckCircle, XCircle, RotateCcw, ClipboardList, ShoppingCart, Clock,
  Search, Filter, ChevronRight, ArrowUpRight, AlertTriangle, Zap,
  MessageSquare, Building2, User, DollarSign, Tag,
  CheckSquare, History, X, Send,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type PRRaw = {
  id: string; prNumber: string; status: string; priority: string
  department: string | null; totalAmount: number; requiredDate: string
  notes: string | null; requestedById: string; createdAt: string; updatedAt: string
  lineItems: Array<{ id: string; description: string; quantity: number; uom: string; estimatedUnitPrice: number; totalPrice: number }>
}
type PORaw = {
  id: string; poNumber: string; status: string; grandTotal: number
  orderDate: string; notes: string | null; createdAt: string; updatedAt: string
  vendor: { name: string }
  lineItems: Array<Record<string, unknown>>
}
type ApprovalData = { pending: { prs: PRRaw[]; pos: PORaw[] }; history: { prs: PRRaw[]; pos: PORaw[] } }

type ApprovalItem = {
  id: string; ref: string; type: 'PR' | 'PO'; module: string
  requestor: string; department: string | null; amount: number
  priority: string; submittedAt: string; waitingHours: number
  notes: string | null; status: string
  lineItems: Array<{ id: string; description: string; qty: number; uom: string; unitPrice: number; total: number }>
  vendor?: string; requiredDate?: string
}

// ─── Priority / status config ─────────────────────────────────────────────────

const PRIORITY: Record<string, { label: string; dot: string; text: string; bg: string; border: string; order: number }> = {
  URGENT: { label: 'Urgent', dot: 'bg-red-500',   text: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200', order: 0 },
  HIGH:   { label: 'High',   dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', order: 1 },
  MEDIUM: { label: 'Medium', dot: 'bg-blue-500',  text: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200', order: 2 },
  LOW:    { label: 'Low',    dot: 'bg-gray-400',  text: 'text-gray-600',  bg: 'bg-gray-50',  border: 'border-gray-200', order: 3 },
}

const STATUS_STYLE: Record<string, string> = {
  PENDING:          'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED:         'bg-red-50 text-red-600 border-red-200',
  CANCELLED:        'bg-red-50 text-red-600 border-red-200',
  DRAFT:            'bg-gray-50 text-gray-600 border-gray-200',
  PO_CREATED:       'bg-blue-50 text-blue-700 border-blue-200',
}

const PR_WORKFLOW = ['Draft', 'Submitted', 'Manager', 'Procurement', 'Approved']
const PO_WORKFLOW = ['Draft', 'Pending Approval', 'Approved', 'In Progress', 'Completed']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function waitingLabel(hours: number): { text: string; color: string } {
  if (hours < 1)  return { text: 'Just submitted',   color: 'text-emerald-600' }
  if (hours < 8)  return { text: `${hours}h waiting`, color: 'text-blue-600' }
  if (hours < 24) return { text: `${hours}h waiting`, color: 'text-amber-600' }
  const days = Math.floor(hours / 24)
  return { text: `${days}d overdue`, color: 'text-red-600' }
}

function normalizeItems(data: ApprovalData | undefined): ApprovalItem[] {
  if (!data) return []
  const now = Date.now()
  const hours = (dateStr: string) => Math.floor((now - new Date(dateStr).getTime()) / 3_600_000)

  const prs: ApprovalItem[] = data.pending.prs.map(pr => ({
    id: pr.id, ref: pr.prNumber, type: 'PR', module: 'Procurement',
    requestor: pr.requestedById, department: pr.department,
    amount: Number(pr.totalAmount), priority: pr.priority ?? 'MEDIUM',
    submittedAt: pr.createdAt, waitingHours: hours(pr.createdAt),
    notes: pr.notes, status: pr.status, requiredDate: pr.requiredDate,
    lineItems: pr.lineItems.map(l => ({
      id: l.id, description: l.description, qty: Number(l.quantity),
      uom: l.uom, unitPrice: Number(l.estimatedUnitPrice), total: Number(l.totalPrice),
    })),
  }))

  const pos: ApprovalItem[] = data.pending.pos.map(po => ({
    id: po.id, ref: po.poNumber, type: 'PO', module: 'Procurement',
    requestor: po.vendor?.name ?? '—', department: null,
    amount: Number(po.grandTotal), priority: 'MEDIUM',
    submittedAt: po.createdAt, waitingHours: hours(po.createdAt),
    notes: po.notes, status: po.status, vendor: po.vendor?.name,
    lineItems: po.lineItems.map((l, i) => ({
      id: String(l.id ?? i),
      description: String(l.description ?? l.itemName ?? 'Item'),
      qty: Number(l.quantity ?? 1),
      uom: String(l.uom ?? 'EA'),
      unitPrice: Number(l.unitPrice ?? l.estimatedUnitPrice ?? 0),
      total: Number(l.totalPrice ?? l.lineTotal ?? 0),
    })),
  }))

  return [...prs, ...pos].sort((a, b) => (PRIORITY[a.priority]?.order ?? 2) - (PRIORITY[b.priority]?.order ?? 2) || b.waitingHours - a.waitingHours)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityPill({ priority }: { priority: string }) {
  const cfg = PRIORITY[priority]
  if (!cfg) return null
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', cfg.bg, cfg.text, cfg.border)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />{cfg.label}
    </span>
  )
}

function WaitingBadge({ hours }: { hours: number }) {
  const { text, color } = waitingLabel(hours)
  return <span className={cn('text-[10px] font-semibold', color)}>{text}</span>
}

function WorkflowBar({ steps, activeIdx }: { steps: string[]; activeIdx: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {steps.map((step, i) => {
        const done  = i < activeIdx
        const active = i === activeIdx
        return (
          <div key={step} className="flex items-center">
            <div className={cn(
              'flex h-6 items-center rounded-full px-2.5 text-[10px] font-semibold',
              done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground/40',
            )}>
              {done && <span className="mr-1 text-[8px]">✓</span>}{step}
            </div>
            {i < steps.length - 1 && <ChevronRight className={cn('h-3 w-3 mx-0.5', done ? 'text-emerald-300' : 'text-muted-foreground/20')} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  item, onApprove, onReject, onRevise, isPending,
}: {
  item: ApprovalItem
  onApprove: (id: string, type: string, note: string) => void
  onReject: (id: string, type: string, reason: string) => void
  onRevise: (id: string, type: string) => void
  isPending: boolean
}) {
  const [action, setAction] = useState<'approve' | 'reject' | 'revise' | null>(null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')

  const workflowSteps = item.type === 'PR' ? PR_WORKFLOW : PO_WORKFLOW
  const activeIdx = item.type === 'PR'
    ? (item.status === 'PENDING' ? 1 : item.status === 'APPROVED' ? 4 : 1)
    : (item.status === 'PENDING_APPROVAL' ? 1 : 2)

  const waiting = waitingLabel(item.waitingHours)

  function handleAction() {
    if (action === 'approve') { onApprove(item.id, item.type, note); setNote(''); setAction(null) }
    else if (action === 'reject') { onReject(item.id, item.type, reason); setReason(''); setAction(null) }
    else if (action === 'revise') { onRevise(item.id, item.type); setAction(null) }
  }

  return (
    <div className="flex flex-col h-full rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="border-b bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-lg">{item.ref}</span>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', STATUS_STYLE[item.status])}>{item.status.replace(/_/g, ' ')}</span>
            </div>
            <p className="text-xs text-muted-foreground">{item.type === 'PR' ? 'Purchase Request' : 'Purchase Order'} · {item.module}</p>
          </div>
          <Link href={item.type === 'PR' ? `/procurement/purchase-requests/${item.id}` : `/procurement/purchase-orders/${item.id}`}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 shrink-0 mt-1">
            Full view <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-2 p-4">
          {[
            { icon: User,       label: item.type === 'PR' ? 'Requested By' : 'Supplier', value: item.requestor },
            { icon: Building2,  label: 'Department', value: item.department ?? '—' },
            { icon: DollarSign, label: 'Amount', value: formatCurrency(item.amount), bold: true },
            { icon: Tag,        label: 'Priority', value: item.priority, isPriority: true },
          ].map(({ icon: Icon, label, value, bold, isPriority }) => (
            <div key={label} className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3 w-3 text-muted-foreground" />
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              </div>
              {isPriority
                ? <PriorityPill priority={value} />
                : <p className={cn('text-sm truncate', bold ? 'font-bold text-indigo-600' : 'font-medium')}>{value}</p>
              }
            </div>
          ))}
        </div>

        {/* SLA badge */}
        <div className="px-4 pb-3">
          <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2',
            item.waitingHours > 24 ? 'bg-red-50 border-red-200' : item.waitingHours > 8 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200',
          )}>
            <Clock className={cn('h-3.5 w-3.5', waiting.color)} />
            <span className={cn('text-xs font-semibold', waiting.color)}>{waiting.text}</span>
            <span className="text-xs text-muted-foreground ml-auto">Submitted {formatDate(item.submittedAt)}</span>
          </div>
        </div>

        {/* Workflow */}
        <div className="px-4 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Approval Pipeline</p>
          <div className="overflow-x-auto pb-1">
            <WorkflowBar steps={workflowSteps} activeIdx={activeIdx} />
          </div>
        </div>

        {/* Notes */}
        {item.notes && (
          <div className="px-4 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Purpose / Notes</p>
            <p className="text-sm text-foreground leading-relaxed border-l-2 border-indigo-200 pl-3 bg-indigo-50/40 py-2 rounded-r-lg">{item.notes}</p>
          </div>
        )}

        {/* Line items */}
        {item.lineItems.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Items ({item.lineItems.length})</p>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/40">
                    <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Qty</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {item.lineItems.slice(0, 6).map(li => (
                    <tr key={li.id} className="hover:bg-muted/20">
                      <td className="px-3 py-1.5 text-foreground truncate max-w-[140px]">{li.description}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">{li.qty} {li.uom}</td>
                      <td className="px-3 py-1.5 text-right font-semibold">{formatCurrency(li.total)}</td>
                    </tr>
                  ))}
                  {item.lineItems.length > 6 && (
                    <tr><td colSpan={3} className="px-3 py-1.5 text-[10px] text-muted-foreground text-center">+{item.lineItems.length - 6} more items</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/50 bg-muted/30">
                    <td colSpan={2} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-indigo-600">{formatCurrency(item.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Action selection form */}
        <div className="px-4 pb-4">
          {action === null ? (
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => setAction('approve')}>
                <CheckCircle className="mr-1 h-3.5 w-3.5" />Approve
              </Button>
              <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50 h-8 text-xs" onClick={() => setAction('revise')}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />Request Changes
              </Button>
              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-8 text-xs" onClick={() => setAction('reject')}>
                <XCircle className="mr-1 h-3.5 w-3.5" />Reject
              </Button>
            </div>
          ) : (
            <div className={cn(
              'rounded-xl border p-4 space-y-3',
              action === 'approve' ? 'bg-emerald-50 border-emerald-200'
              : action === 'reject' ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200',
            )}>
              <div className="flex items-center justify-between">
                <p className={cn('text-sm font-semibold',
                  action === 'approve' ? 'text-emerald-700' : action === 'reject' ? 'text-red-700' : 'text-amber-700',
                )}>
                  {action === 'approve' ? '✓ Approve Request' : action === 'reject' ? '✗ Reject Request' : '↩ Request Changes'}
                </p>
                <button type="button" onClick={() => { setAction(null); setNote(''); setReason('') }}
                  className="text-muted-foreground/50 hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {action === 'approve' && (
                <>
                  <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Optional approval note…" className="min-h-[60px] text-xs bg-white border-emerald-200 resize-none" />
                  <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAction} disabled={isPending}>
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />{isPending ? 'Approving…' : 'Confirm Approval'}
                  </Button>
                </>
              )}
              {action === 'reject' && (
                <>
                  <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Rejection reason (required)…" className="min-h-[72px] text-xs bg-white border-red-200 resize-none" />
                  <Button size="sm" variant="destructive" className="w-full" onClick={handleAction} disabled={isPending || !reason.trim()}>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />{isPending ? 'Rejecting…' : 'Confirm Rejection'}
                  </Button>
                </>
              )}
              {action === 'revise' && (
                <>
                  <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What changes are needed?…" className="min-h-[60px] text-xs bg-white border-amber-200 resize-none" />
                  <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white" onClick={handleAction} disabled={isPending}>
                    <Send className="mr-1.5 h-3.5 w-3.5" />{isPending ? 'Sending…' : 'Send Back for Revision'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApprovalCenterPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [filterPriority, setFilterPriority] = useState('ALL')
  const [viewTab, setViewTab] = useState<'pending' | 'history'>('pending')

  const { data, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => api.get<ApprovalData>('/api/procurement/approvals').then(r => r.data!),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const queue = useMemo(() => normalizeItems(data), [data])

  const filtered = useMemo(() => {
    return queue.filter(item => {
      const q = search.toLowerCase()
      const matchSearch = !search || item.ref.toLowerCase().includes(q) || (item.requestor ?? '').toLowerCase().includes(q) || (item.department ?? '').toLowerCase().includes(q)
      const matchType = filterType === 'ALL' || item.type === filterType
      const matchPriority = filterPriority === 'ALL' || item.priority === filterPriority
      return matchSearch && matchType && matchPriority
    })
  }, [queue, search, filterType, filterPriority])

  const selectedItem = selectedId ? queue.find(i => i.id === selectedId) ?? null : null

  // KPI computations
  const today = new Date().toDateString()
  const kpis = useMemo(() => {
    const historyPRs = data?.history.prs ?? []
    const historyPOs = data?.history.pos ?? []
    const approvedToday = [...historyPRs, ...historyPOs].filter(d => new Date(d.updatedAt ?? d.createdAt).toDateString() === today && (d.status === 'APPROVED')).length
    const rejectedToday = [...historyPRs, ...historyPOs].filter(d => new Date(d.updatedAt ?? d.createdAt).toDateString() === today && (d.status === 'REJECTED' || d.status === 'CANCELLED')).length
    const overdue = queue.filter(i => i.waitingHours > 24).length
    const avgHrs = queue.length > 0 ? (queue.reduce((s, i) => s + i.waitingHours, 0) / queue.length).toFixed(1) : '0'
    return { pending: queue.length, approvedToday, rejectedToday, overdue, avgHrs }
  }, [queue, data, today])

  // Mutations
  const prMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      api.patch(`/api/procurement/purchase-requests/${id}`, { status, ...(notes ? { notes } : {}) }),
    onSuccess: (_, { status }) => {
      toast.success(status === 'APPROVED' ? 'PR Approved' : status === 'REJECTED' ? 'PR Rejected' : 'Returned for revision')
      qc.invalidateQueries({ queryKey: ['approvals'] })
      setSelectedId(null)
    },
    onError: () => toast.error('Action failed'),
  })

  const poMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/procurement/purchase-orders/${id}`, { status }),
    onSuccess: (_, { status }) => {
      toast.success(status === 'APPROVED' ? 'PO Approved' : status === 'CANCELLED' ? 'PO Rejected' : 'Returned for revision')
      qc.invalidateQueries({ queryKey: ['approvals'] })
      setSelectedId(null)
    },
    onError: () => toast.error('Action failed'),
  })

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: 'approve' | 'reject' }) => {
      const items = queue.filter(i => ids.includes(i.id))
      await Promise.all(items.map(item =>
        item.type === 'PR'
          ? api.patch(`/api/procurement/purchase-requests/${item.id}`, { status: action === 'approve' ? 'APPROVED' : 'REJECTED' })
          : api.patch(`/api/procurement/purchase-orders/${item.id}`, { status: action === 'approve' ? 'APPROVED' : 'CANCELLED' }),
      ))
    },
    onSuccess: (_, { action }) => {
      toast.success(`${selected.length} item(s) ${action === 'approve' ? 'approved' : 'rejected'}`)
      qc.invalidateQueries({ queryKey: ['approvals'] })
      setSelected([])
      setSelectedId(null)
    },
    onError: () => toast.error('Bulk action failed'),
  })

  function handleApprove(id: string, type: string, note: string) {
    if (type === 'PR') prMutation.mutate({ id, status: 'APPROVED', notes: note || undefined })
    else poMutation.mutate({ id, status: 'APPROVED' })
  }
  function handleReject(id: string, type: string, reason: string) {
    if (type === 'PR') prMutation.mutate({ id, status: 'REJECTED', notes: reason })
    else poMutation.mutate({ id, status: 'CANCELLED' })
  }
  function handleRevise(id: string, type: string) {
    if (type === 'PR') prMutation.mutate({ id, status: 'DRAFT' })
    else poMutation.mutate({ id, status: 'DRAFT' })
  }

  function toggleSelect(id: string) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }
  function toggleAll() {
    setSelected(p => p.length === filtered.length ? [] : filtered.map(i => i.id))
  }

  const isPending = prMutation.isPending || poMutation.isPending || bulkMutation.isPending

  const historyAll = useMemo(() => [
    ...(data?.history.prs ?? []).map(pr => ({ ref: pr.prNumber, type: 'PR', amount: Number(pr.totalAmount), status: pr.status, date: pr.updatedAt ?? pr.createdAt, id: pr.id })),
    ...(data?.history.pos ?? []).map(po => ({ ref: po.poNumber, type: 'PO', amount: Number(po.grandTotal), status: po.status, date: po.updatedAt ?? po.createdAt, id: po.id })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20), [data])

  if (isLoading) return (
    <div className="space-y-5">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>
      <div className="h-96 animate-pulse rounded-xl bg-muted" />
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Approval Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Review and action pending approvals across all modules</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewTab === 'pending' ? 'default' : 'ghost'}
            size="sm" className="h-8 text-xs"
            onClick={() => setViewTab('pending')}
          >
            <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
            Pending {kpis.pending > 0 && <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">{kpis.pending}</span>}
          </Button>
          <Button
            variant={viewTab === 'history' ? 'default' : 'ghost'}
            size="sm" className="h-8 text-xs"
            onClick={() => setViewTab('history')}
          >
            <History className="mr-1.5 h-3.5 w-3.5" />History
          </Button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { icon: Clock,       label: 'Pending Approvals', value: kpis.pending,      color: 'text-amber-600', bg: 'bg-amber-50', ring: kpis.pending > 0 },
          { icon: CheckCircle, label: 'Approved Today',    value: kpis.approvedToday, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { icon: XCircle,     label: 'Rejected Today',   value: kpis.rejectedToday, color: 'text-red-500', bg: 'bg-red-50' },
          { icon: AlertTriangle,label: 'Overdue',         value: kpis.overdue,       color: 'text-red-600', bg: 'bg-red-50', ring: kpis.overdue > 0 },
          { icon: Zap,         label: 'Avg Wait Time',   value: `${kpis.avgHrs}h`,  color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(({ icon: Icon, label, value, color, bg, ring }) => (
          <Card key={label} className={cn(', ring ? 'ring-1 ring-amber-200' : '')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg', bg)}>
                  <Icon className={cn('h-3.5 w-3.5', color)} />
                </div>
              </div>
              <p className={cn('text-xl font-bold', ring ? color : '')}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {viewTab === 'pending' && (
        <>
          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search document, requestor, department…" className="pl-9 h-8 text-xs" />
            </div>
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Types</SelectItem>
                <SelectItem value="PR" className="text-xs">Purchase Requests</SelectItem>
                <SelectItem value="PO" className="text-xs">Purchase Orders</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Priorities</SelectItem>
                {Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {(search || filterType !== 'ALL' || filterPriority !== 'ALL') && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setSearch(''); setFilterType('ALL'); setFilterPriority('ALL') }}>
                <X className="h-3 w-3 mr-1" />Clear
              </Button>
            )}
          </div>

          {/* ── Bulk action bar ── */}
          {selected.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5">
              <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
              <span className="text-sm font-semibold text-indigo-800">{selected.length} selected</span>
              <div className="flex gap-2 ml-auto">
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => bulkMutation.mutate({ ids: selected, action: 'approve' })}
                  disabled={isPending}>
                  <CheckCircle className="mr-1 h-3 w-3" />Approve All
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => bulkMutation.mutate({ ids: selected, action: 'reject' })}
                  disabled={isPending}>
                  <XCircle className="mr-1 h-3 w-3" />Reject All
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected([])}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Main split panel ── */}
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-base font-semibold">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No pending approvals at this time.</p>
            </div>
          ) : (
            <div className={cn('grid gap-5', selectedItem ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1')}>

              {/* Queue */}
              <div className={cn(selectedItem ? 'lg:col-span-3' : 'col-span-1')}>
                <Card >
                  {/* Table header */}
                  <div className="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.length === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded"
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">Document</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24 hidden sm:block">Requestor</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24 text-right hidden md:block">Amount</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-20 text-right hidden lg:block">Waiting</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-20 text-right">Actions</span>
                  </div>

                  {/* Queue rows */}
                  <div className="divide-y divide-border/40">
                    {filtered.length === 0 ? (
                      <p className="px-5 py-8 text-sm text-center text-muted-foreground">No items match the current filters.</p>
                    ) : filtered.map(item => {
                      const isSelected = selectedId === item.id
                      const isChecked = selected.includes(item.id)
                      const prCfg = PRIORITY[item.priority]
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-muted/30 group',
                            isSelected ? 'bg-indigo-50/60 border-l-2 border-indigo-500 -ml-px pl-[calc(1rem-1px)]' : 'border-l-2 border-transparent',
                            item.waitingHours > 24 ? 'border-l-red-300' : '',
                          )}
                          onClick={() => setSelectedId(isSelected ? null : item.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onClick={e => e.stopPropagation()}
                            onChange={() => toggleSelect(item.id)}
                            className="h-3.5 w-3.5 rounded shrink-0"
                          />

                          {/* Priority dot + type icon */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn('h-2 w-2 rounded-full shrink-0', prCfg?.dot ?? 'bg-gray-400')} />
                            <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', item.type === 'PR' ? 'bg-purple-50' : 'bg-teal-50')}>
                              {item.type === 'PR'
                                ? <ClipboardList className="h-3.5 w-3.5 text-purple-600" />
                                : <ShoppingCart className="h-3.5 w-3.5 text-teal-600" />
                              }
                            </div>
                          </div>

                          {/* Main info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{item.ref}</span>
                              <span className={cn('text-[9px] font-bold rounded-full border px-1.5 py-0.5', item.type === 'PR' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-teal-50 text-teal-600 border-teal-200')}>{item.type}</span>
                              {item.department && <span className="text-[10px] text-muted-foreground">{item.department}</span>}
                            </div>
                          </div>

                          {/* Requestor */}
                          <span className="text-xs text-muted-foreground truncate w-24 hidden sm:block">{item.requestor}</span>

                          {/* Amount */}
                          <span className="text-sm font-bold text-foreground w-24 text-right shrink-0 hidden md:block">{formatCurrency(item.amount)}</span>

                          {/* Waiting */}
                          <div className="w-20 text-right hidden lg:block">
                            <WaitingBadge hours={item.waitingHours} />
                          </div>

                          {/* Quick action buttons */}
                          <div className="flex gap-1 shrink-0 w-20 justify-end">
                            <Button
                              size="icon"
                              className="h-6 w-6 bg-emerald-500 hover:bg-emerald-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={e => { e.stopPropagation(); handleApprove(item.id, item.type, '') }}
                              disabled={isPending}
                              title="Approve"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6 border-red-200 text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={e => { e.stopPropagation(); setSelectedId(item.id) }}
                              disabled={isPending}
                              title="Reject (opens panel)"
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {filtered.length !== queue.length && (
                    <div className="border-t border-border/40 px-4 py-2 text-xs text-muted-foreground bg-muted/20">
                      Showing {filtered.length} of {queue.length} pending approvals
                    </div>
                  )}
                </Card>
              </div>

              {/* Detail panel */}
              <div className="lg:col-span-2">
                {selectedItem ? (
                  <div className="sticky top-4">
                    <DetailPanel
                      item={selectedItem}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onRevise={handleRevise}
                      isPending={isPending}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center h-full min-h-64">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Select an item</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Click any row to review details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── History Tab ── */}
      {viewTab === 'history' && (
        <Card >
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Recent Decisions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyAll.length === 0 ? (
              <p className="px-5 py-8 text-sm text-center text-muted-foreground">No approval history yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    {['Document', 'Type', 'Amount', 'Decision', 'Date', ''].map(h => (
                      <th key={h} className={cn('px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70', h === 'Amount' || h === 'Decision' ? 'text-right' : 'text-left')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {historyAll.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-semibold">
                        <Link
                          href={row.type === 'PR' ? `/procurement/purchase-requests/${row.id}` : `/procurement/purchase-orders/${row.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {row.ref}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-semibold', row.type === 'PR' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-teal-50 text-teal-600 border-teal-200')}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(row.amount)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-semibold', STATUS_STYLE[row.status] ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
                          {row.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(row.date)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={row.type === 'PR' ? `/procurement/purchase-requests/${row.id}` : `/procurement/purchase-orders/${row.id}`}
                          className="text-[10px] text-muted-foreground hover:text-foreground">
                          View <ArrowUpRight className="inline h-2.5 w-2.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
