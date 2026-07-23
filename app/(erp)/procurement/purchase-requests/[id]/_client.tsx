'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft, CheckCircle, XCircle, Send, FileSearch, ShoppingCart,
  Clock, AlertTriangle, ClipboardList, ChevronRight, Package,
  Truck, Receipt, CreditCard, MessageSquare, Activity, Paperclip,
  Calendar, User, Building2, DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type PRDetail = {
  id: string; prNumber: string; status: string; requiredDate: string
  totalAmount: number; department: string | null; notes: string | null
  priority: string | null; createdAt: string; updatedAt: string
  requestedById: string
  vendor: { name: string } | null
  lineItems: Array<{ id: string; description: string; quantity: number; uom: string; estimatedUnitPrice: number; totalPrice: number }>
  purchaseOrder: { id: string; poNumber: string; status: string } | null
  rfqs: Array<{ id: string; rfqNumber: string; status: string }>
}

const PRIORITY_STYLE: Record<string, { text: string; bg: string; dot: string }> = {
  LOW:    { text: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',   dot: 'bg-gray-400' },
  MEDIUM: { text: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',   dot: 'bg-blue-500' },
  HIGH:   { text: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  URGENT: { text: 'text-red-700',    bg: 'bg-red-50 border-red-200',     dot: 'bg-red-500' },
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT:      'bg-gray-50 text-gray-600 border-gray-200',
  PENDING:    'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED:   'bg-red-50 text-red-600 border-red-200',
  PO_CREATED: 'bg-blue-50 text-blue-700 border-blue-200',
}

const LIFECYCLE_STAGES = [
  { key: 'pr',       label: 'Purchase Request', icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  { key: 'rfq',      label: 'RFQ',              icon: FileSearch,    color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  { key: 'quote',    label: 'Quotation',         icon: Receipt,       color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { key: 'po',       label: 'Purchase Order',    icon: ShoppingCart,  color: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  { key: 'delivery', label: 'Delivery',          icon: Truck,         color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  { key: 'grn',      label: 'GRN',               icon: Package,       color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200' },
  { key: 'invoice',  label: 'Invoice',           icon: Receipt,       color: 'text-cyan-600',   bg: 'bg-cyan-50',   border: 'border-cyan-200' },
  { key: 'payment',  label: 'Payment',           icon: CreditCard,    color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
]

const APPROVAL_CHAIN = [
  { label: 'Employee',           desc: 'Requested by user', threshold: 0 },
  { label: 'Department Manager', desc: 'Up to £5,000',      threshold: 500 },
  { label: 'Procurement Mgr',   desc: 'Up to £25,000',     threshold: 5000 },
  { label: 'Finance Manager',   desc: 'All requests',       threshold: 25000 },
]

const PR_WORKFLOW = [
  { key: 'need',        label: 'Need' },
  { key: 'draft',       label: 'Draft',           match: ['DRAFT'] },
  { key: 'submitted',   label: 'Submitted',        match: ['PENDING'] },
  { key: 'manager',     label: 'Manager Approval', match: [] },
  { key: 'procurement', label: 'Procurement',      match: ['APPROVED'] },
  { key: 'rfq',         label: 'RFQ / PO',         match: ['PO_CREATED'] },
]

function prWorkflowIndex(status: string) {
  if (status === 'DRAFT') return 1
  if (status === 'PENDING') return 2
  if (status === 'APPROVED') return 4
  if (status === 'PO_CREATED') return 5
  if (status === 'REJECTED') return 2
  return 0
}

function WorkflowHeader({ status }: { status: string }) {
  const activeIdx = prWorkflowIndex(status)
  const rejected = status === 'REJECTED'
  return (
    <div className="flex items-center gap-0 flex-wrap">
      {PR_WORKFLOW.map((step, i) => {
        const done = i < activeIdx && !rejected
        const active = i === activeIdx && !rejected
        const isRejected = rejected && i === 2
        return (
          <div key={step.key} className="flex items-center">
            <div className={cn(
              'flex h-7 items-center rounded-full px-3 text-[11px] font-semibold transition-all',
              isRejected ? 'bg-red-500 text-white' : done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-indigo-600 text-white' : 'bg-muted/60 text-muted-foreground/50',
            )}>
              {done && !rejected && <span className="mr-1 text-[9px]">✓</span>}
              {step.label}
            </div>
            {i < PR_WORKFLOW.length - 1 && (
              <ChevronRight className={cn('h-3 w-3 mx-0.5', done ? 'text-emerald-400' : 'text-muted-foreground/20')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function LifecycleView({ pr }: { pr: PRDetail }) {
  const hasRFQ = pr.rfqs.length > 0
  const hasPO = !!pr.purchaseOrder

  function stageState(key: string): 'done' | 'active' | 'pending' {
    if (key === 'pr') return pr.status === 'DRAFT' || pr.status === 'PENDING' ? 'active' : 'done'
    if (key === 'rfq') return hasRFQ ? 'done' : pr.status === 'APPROVED' ? 'active' : 'pending'
    if (key === 'quote') return hasRFQ ? 'active' : 'pending'
    if (key === 'po') return hasPO ? 'done' : hasRFQ ? 'active' : 'pending'
    return 'pending'
  }

  return (
    <div className="flex items-start gap-2 overflow-x-auto pb-2">
      {LIFECYCLE_STAGES.map((stage, i) => {
        const state = stageState(stage.key)
        const Icon = stage.icon
        return (
          <div key={stage.key} className="flex items-center shrink-0">
            <div className={cn(
              'flex flex-col items-center gap-2 rounded-xl border p-3 min-w-[88px] transition-all',
              state === 'done' ? 'bg-emerald-50 border-emerald-200' : state === 'active' ? `${stage.bg} ${stage.border}` : 'bg-muted/20 border-border/40',
            )}>
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full',
                state === 'done' ? 'bg-emerald-100' : state === 'active' ? stage.bg : 'bg-muted/50',
              )}>
                <Icon className={cn('h-4 w-4', state === 'done' ? 'text-emerald-600' : state === 'active' ? stage.color : 'text-muted-foreground/30')} />
              </div>
              <span className={cn('text-[10px] font-semibold text-center leading-tight', state === 'done' ? 'text-emerald-700' : state === 'active' ? stage.color : 'text-muted-foreground/40')}>
                {stage.label}
              </span>
              <div className={cn('h-1.5 w-1.5 rounded-full', state === 'done' ? 'bg-emerald-500' : state === 'active' ? 'bg-current animate-pulse' : 'bg-muted-foreground/20')} />
            </div>
            {i < LIFECYCLE_STAGES.length - 1 && (
              <div className={cn('h-px w-4 shrink-0', state === 'done' ? 'bg-emerald-300' : 'bg-border/40')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ApprovalChain({ amount }: { amount: number }) {
  return (
    <div className="space-y-2">
      {APPROVAL_CHAIN.map((step, i) => {
        const required = amount >= step.threshold
        return (
          <div key={step.label} className={cn(
            'flex items-center gap-3 rounded-lg border px-3 py-2.5',
            required ? 'bg-indigo-50/60 border-indigo-100' : 'bg-muted/20 border-border/40 opacity-40',
          )}>
            <div className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0',
              required ? 'bg-indigo-100 text-indigo-700' : 'bg-muted text-muted-foreground',
            )}>{i + 1}</div>
            <div className="min-w-0 flex-1">
              <p className={cn('text-xs font-semibold', required ? '' : 'text-muted-foreground')}>{step.label}</p>
              <p className="text-[10px] text-muted-foreground">{step.desc}</p>
            </div>
            {required && <ChevronRight className="h-3 w-3 text-indigo-300 shrink-0" />}
          </div>
        )
      })}
    </div>
  )
}

export function PageClient({ id, initialData }: { id: string; initialData: PRDetail }) {
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectBox, setShowRejectBox] = useState(false)

  const { data: pr, isLoading } = useQuery({
    queryKey: ['pr', id],
    queryFn: () => api.get<PRDetail>(`/api/procurement/purchase-requests/${id}`).then(r => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const statusMutation = useMutation({
    mutationFn: (payload: { status: string; rejectionReason?: string }) =>
      api.patch(`/api/procurement/purchase-requests/${id}`, payload),
    onSuccess: (res, { status }) => {
      toast.success(status === 'APPROVED' ? 'PR Approved' : status === 'REJECTED' ? 'PR Rejected' : 'Status updated')
      if (res.success && res.data) qc.setQueryData(['pr', id], res.data)
      qc.invalidateQueries({ queryKey: ['pr', id] })
      qc.invalidateQueries({ queryKey: ['prs'] })
      setShowRejectBox(false)
      setRejectReason('')
    },
    onError: () => toast.error('Failed to update status'),
  })

  if (isLoading) return (
    <div className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
    </div>
  )
  if (!pr) return <div className="py-20 text-center text-muted-foreground">Purchase request not found.</div>

  const amount = Number(pr.totalAmount)
  const isOverdue = !['APPROVED', 'REJECTED', 'PO_CREATED'].includes(pr.status) && new Date(pr.requiredDate) < new Date()
  const priorityCfg = PRIORITY_STYLE[pr.priority ?? 'MEDIUM']

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0" asChild>
            <Link href="/procurement/purchase-requests"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{pr.prNumber}</h1>
              <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLE[pr.status])}>
                {pr.status.replace(/_/g, ' ')}
              </span>
              {pr.priority && (
                <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold', priorityCfg.bg, priorityCfg.text)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', priorityCfg.dot)} />
                  {pr.priority}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {pr.department ?? 'Purchase Request'} · {formatCurrency(amount)} · Created {formatDate(pr.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {pr.status === 'DRAFT' && (
            <Button
              size="sm" className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => statusMutation.mutate({ status: 'PENDING' })}
              disabled={statusMutation.isPending}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />Submit for Approval
            </Button>
          )}
          {pr.status === 'PENDING' && !showRejectBox && (
            <>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => statusMutation.mutate({ status: 'APPROVED' })}
                disabled={statusMutation.isPending}>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Approve
              </Button>
              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => setShowRejectBox(true)}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" />Reject
              </Button>
            </>
          )}
          {pr.status === 'APPROVED' && !pr.purchaseOrder && (
            <>
              <Button size="sm" asChild>
                <Link href={`/procurement/purchase-orders/new?prId=${pr.id}`}>
                  <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />Create PO
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/procurement/rfqs?prId=${pr.id}`}>
                  <FileSearch className="mr-1.5 h-3.5 w-3.5" />Create RFQ
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {showRejectBox && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-red-800">Rejection Reason</p>
          <Textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Explain why this request is being rejected…"
            className="min-h-[72px] bg-white border-red-200 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive"
              onClick={() => statusMutation.mutate({ status: 'REJECTED', rejectionReason: rejectReason })}
              disabled={statusMutation.isPending || !rejectReason.trim()}>
              Confirm Rejection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowRejectBox(false); setRejectReason('') }}>Cancel</Button>
          </div>
        </div>
      )}

      <Card className="border-border/60 shadow-sm">
        <CardContent className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Procurement Pipeline</p>
          <WorkflowHeader status={pr.status} />
          {pr.status === 'DRAFT' && (
            <p className="text-xs text-muted-foreground mt-2">→ Submit this request to start the approval process</p>
          )}
          {pr.status === 'PENDING' && (
            <p className="text-xs text-amber-600 mt-2">→ Awaiting manager approval · Est. value {formatCurrency(amount)}</p>
          )}
          {pr.status === 'APPROVED' && !pr.purchaseOrder && (
            <p className="text-xs text-indigo-600 mt-2">→ Approved — create an RFQ or Purchase Order to continue</p>
          )}
        </CardContent>
      </Card>

      {pr.status === 'PENDING' && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">Approval required — </span>
            {amount < 500 ? 'Department Manager approval needed.'
              : amount < 5000 ? 'Finance Manager approval needed.'
              : 'Director-level approval required.'}
            {' '}Estimated value: <strong>{formatCurrency(amount)}</strong>
          </div>
        </div>
      )}
      {pr.status === 'REJECTED' && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 font-medium">This purchase request was rejected. Please revise and resubmit.</p>
        </div>
      )}
      {isOverdue && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
          <p className="text-sm text-orange-800">
            <span className="font-semibold">Required date passed — </span>
            This request was needed by <strong>{formatDate(pr.requiredDate)}</strong>.
          </p>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-8 text-xs gap-0.5 bg-muted/50">
          {[
            { value: 'overview',  label: 'Overview',          icon: ClipboardList },
            { value: 'items',     label: 'Items',             icon: Package },
            { value: 'approvals', label: 'Approvals',         icon: CheckCircle },
            { value: 'comments',  label: 'Comments',          icon: MessageSquare },
            { value: 'activity',  label: 'Activity',          icon: Activity },
            { value: 'related',   label: 'Related Documents', icon: Paperclip },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="h-7 text-[11px] px-3 gap-1.5">
              <Icon className="h-3 w-3" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Building2, label: 'Department',   value: pr.department ?? '—' },
              { icon: Calendar,  label: 'Required By',  value: formatDate(pr.requiredDate), warn: isOverdue },
              { icon: DollarSign,label: 'Est. Total',   value: formatCurrency(amount), bold: true },
              { icon: User,      label: 'Requested By', value: pr.requestedById ?? '—' },
            ].map(({ icon: Icon, label, value, warn, bold }) => (
              <Card key={label} className="border-border/60 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  </div>
                  <p className={cn('text-sm', bold ? 'font-bold text-indigo-600' : 'font-medium', warn ? 'text-red-600' : '')}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {pr.notes && (
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Purpose / Justification</p>
                <p className="text-sm text-foreground leading-relaxed">{pr.notes}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Budget Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-center">
                    <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-1">Requested</p>
                    <p className="text-xl font-bold text-indigo-700">{formatCurrency(amount)}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Available Budget</p>
                    <p className="text-xl font-bold text-emerald-700">{formatCurrency(50_000)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Budget Utilization</span>
                    <span>{((amount / 50_000) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${Math.min((amount / 50_000) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Requested: {formatCurrency(amount)}</span>
                    <span>Remaining: {formatCurrency(50_000 - amount)}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 border-t border-border/40 pt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Tax Estimate (5%)</span>
                    <span>{formatCurrency(amount * 0.05)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-border/40 pt-1.5">
                    <span>Grand Total</span>
                    <span className="text-indigo-600">{formatCurrency(amount * 1.05)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-indigo-500" />
                  Approval Chain
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <ApprovalChain amount={amount} />
                <div className="mt-4 rounded-lg bg-muted/40 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Expected procurement time: <strong>5–7 business days</strong></p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="items">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-500" />
                Requested Items ({pr.lineItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['#', 'Description', 'Qty', 'Unit', 'Est. Price', 'Total'].map(h => (
                      <th key={h} className={cn('pb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70', h === '#' || h === 'Qty' || h === 'Unit' || h === 'Est. Price' || h === 'Total' ? 'text-right' : 'text-left')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {pr.lineItems.map((l, i) => (
                    <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 text-right text-xs text-muted-foreground/50 w-8">{i + 1}</td>
                      <td className="py-3 pl-3 font-medium">{l.description}</td>
                      <td className="py-3 text-right">{Number(l.quantity)}</td>
                      <td className="py-3 text-right text-xs text-muted-foreground">{l.uom}</td>
                      <td className="py-3 text-right">{formatCurrency(Number(l.estimatedUnitPrice))}</td>
                      <td className="py-3 text-right font-bold">{formatCurrency(Number(l.totalPrice))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border/60">
                  <tr>
                    <td colSpan={5} className="pt-3 text-right text-sm font-semibold text-muted-foreground">Subtotal</td>
                    <td className="pt-3 text-right text-sm font-bold">{formatCurrency(amount)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="pt-1 text-right text-xs text-muted-foreground">Tax Est. (5%)</td>
                    <td className="pt-1 text-right text-xs">{formatCurrency(amount * 0.05)}</td>
                  </tr>
                  <tr className="border-t border-border/60">
                    <td colSpan={5} className="pt-3 text-right text-sm font-bold">Grand Total</td>
                    <td className="pt-3 text-right text-sm font-bold text-indigo-600">{formatCurrency(amount * 1.05)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-indigo-500" />
                Approval Status
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {APPROVAL_CHAIN.map((level, i) => {
                const required = amount >= level.threshold
                const isApproved = pr.status === 'APPROVED' || pr.status === 'PO_CREATED'
                const isRejected = pr.status === 'REJECTED'
                const isPending = pr.status === 'PENDING' && required && i === 1
                return (
                  <div key={level.label} className={cn(
                    'flex items-center gap-4 rounded-xl border p-4',
                    isApproved && required ? 'bg-emerald-50 border-emerald-200'
                      : isRejected && required ? 'bg-red-50 border-red-200'
                      : isPending ? 'bg-amber-50 border-amber-200'
                      : required ? 'bg-muted/20 border-border/60'
                      : 'opacity-30 border-border/30 bg-muted/10',
                  )}>
                    <div className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      isApproved && required ? 'bg-emerald-100 text-emerald-700'
                        : isRejected && required ? 'bg-red-100 text-red-600'
                        : isPending ? 'bg-amber-100 text-amber-700'
                        : 'bg-muted text-muted-foreground',
                    )}>
                      {isApproved && required ? '✓' : isRejected && required ? '✗' : i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{level.label}</p>
                      <p className="text-xs text-muted-foreground">{level.desc}</p>
                    </div>
                    <span className={cn(
                      'text-xs font-semibold rounded-full px-3 py-1 border',
                      isApproved && required ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : isRejected && required ? 'bg-red-100 text-red-600 border-red-200'
                        : isPending ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : required ? 'bg-muted text-muted-foreground border-border/40'
                        : 'bg-transparent text-muted-foreground/40 border-transparent',
                    )}>
                      {isApproved && required ? 'Approved' : isRejected && required ? 'Rejected' : isPending ? 'Pending' : required ? 'Waiting' : 'N/A'}
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                Comments & Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {pr.notes && (
                <div className="mb-4 flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                    {(pr.requestedById ?? 'U')[0].toUpperCase()}
                  </div>
                  <div className="rounded-xl rounded-tl-none bg-muted/40 border border-border/60 px-4 py-3 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{pr.requestedById ?? 'Requester'}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(pr.createdAt)}</span>
                    </div>
                    <p className="text-sm text-foreground">{pr.notes}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  Y
                </div>
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Add a comment or note…"
                    className="min-h-[80px] resize-none text-sm"
                  />
                  <Button
                    size="sm" disabled={!comment.trim()}
                    onClick={() => { toast.success('Comment added'); setComment('') }}
                  >
                    Add Comment
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="space-y-4">
                {[
                  { label: 'PR Created', sub: `By ${pr.requestedById}`, date: pr.createdAt, color: 'bg-purple-500' },
                  ...(pr.status !== 'DRAFT' ? [{ label: 'Submitted for Approval', sub: 'Sent to manager', date: pr.updatedAt, color: 'bg-amber-500' }] : []),
                  ...(pr.status === 'APPROVED' ? [{ label: 'Approved', sub: 'By procurement manager', date: pr.updatedAt, color: 'bg-emerald-500' }] : []),
                  ...(pr.status === 'REJECTED' ? [{ label: 'Rejected', sub: 'See rejection reason', date: pr.updatedAt, color: 'bg-red-500' }] : []),
                  ...(pr.rfqs.length > 0 ? [{ label: `RFQ Created (${pr.rfqs.length})`, sub: pr.rfqs.map(r => r.rfqNumber).join(', '), date: pr.updatedAt, color: 'bg-blue-500' }] : []),
                  ...(pr.purchaseOrder ? [{ label: 'Purchase Order Created', sub: pr.purchaseOrder.poNumber, date: pr.updatedAt, color: 'bg-teal-500' }] : []),
                ].map((event, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="relative flex flex-col items-center">
                      <div className={cn('h-3 w-3 rounded-full shrink-0 mt-1', event.color)} />
                      {i < 4 && <div className="w-px flex-1 bg-border/40 mt-1" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-semibold">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{event.sub}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatDate(event.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="related" className="space-y-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-gray-500" />
                Procurement Lifecycle
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <LifecycleView pr={pr} />
            </CardContent>
          </Card>

          {pr.rfqs.length > 0 && (
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-blue-500" />
                  Linked RFQs ({pr.rfqs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2">
                {pr.rfqs.map(r => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5">
                    <Link href={`/procurement/rfqs/${r.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                      {r.rfqNumber}
                    </Link>
                    <span className={cn('text-[11px] font-semibold rounded-full border px-2 py-0.5', STATUS_STYLE[r.status] ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {pr.purchaseOrder && (
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-teal-500" />
                  Purchase Order
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="flex items-center justify-between rounded-lg border border-teal-100 bg-teal-50 px-4 py-3">
                  <Link href={`/procurement/purchase-orders/${pr.purchaseOrder.id}`} className="text-sm font-bold text-teal-700 hover:text-teal-900">
                    {pr.purchaseOrder.poNumber}
                  </Link>
                  <span className={cn('text-[11px] font-semibold rounded-full border px-2 py-0.5', STATUS_STYLE[pr.purchaseOrder.status] ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
                    {pr.purchaseOrder.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {!pr.purchaseOrder && pr.rfqs.length === 0 && pr.status === 'APPROVED' && (
            <Card className="border-indigo-100 bg-indigo-50/40 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-indigo-700 mb-3">Next Steps</p>
                <div className="flex gap-3">
                  <Button size="sm" asChild>
                    <Link href={`/procurement/rfqs?prId=${pr.id}`}>
                      <FileSearch className="mr-1.5 h-3.5 w-3.5" />Create RFQ
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/procurement/purchase-orders/new?prId=${pr.id}`}>
                      <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />Create PO Directly
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
