'use client'

import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import Link from 'next/link'

export type WorkflowStage = {
  label: string
  sublabel?: string
  state: 'completed' | 'current' | 'pending' | 'skipped' | 'rejected'
  href?: string
  optional?: boolean
}

type WorkflowTrackerProps = {
  stages: WorkflowStage[]
  className?: string
  compact?: boolean
}

const STATE_STYLES = {
  completed: {
    circle: 'bg-emerald-500 border-emerald-500 text-white',
    label: 'text-emerald-700 font-semibold',
    connector: 'bg-emerald-400',
  },
  current: {
    circle: 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100',
    label: 'text-blue-700 font-bold',
    connector: 'bg-gray-200',
  },
  pending: {
    circle: 'bg-white border-2 border-gray-200 text-gray-300',
    label: 'text-gray-400',
    connector: 'bg-gray-200',
  },
  skipped: {
    circle: 'bg-gray-100 border-2 border-dashed border-gray-300 text-gray-300',
    label: 'text-gray-400 italic',
    connector: 'bg-gray-200',
  },
  rejected: {
    circle: 'bg-red-500 border-red-500 text-white',
    label: 'text-red-600 font-semibold',
    connector: 'bg-gray-200',
  },
}

function StageIcon({ state, index }: { state: WorkflowStage['state']; index: number }) {
  if (state === 'completed') return <Check className="h-3 w-3 stroke-[3]" />
  if (state === 'rejected') return <X className="h-3 w-3 stroke-[3]" />
  if (state === 'current') return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
    </span>
  )
  return <span className="text-[10px] font-bold text-gray-400">{index + 1}</span>
}

export function WorkflowTracker({ stages, className, compact = false }: WorkflowTrackerProps) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div className={cn('flex items-start', compact ? 'min-w-max gap-0' : 'min-w-max gap-0')}>
        {stages.map((stage, i) => {
          const styles = STATE_STYLES[stage.state]
          const isLast = i === stages.length - 1

          const content = (
            <div className="flex flex-col items-center">
              {/* Circle */}
              <div className={cn(
                'flex items-center justify-center rounded-full flex-shrink-0 transition-all',
                compact ? 'h-6 w-6' : 'h-8 w-8',
                styles.circle
              )}>
                <StageIcon state={stage.state} index={i} />
              </div>

              {/* Label */}
              {!compact && (
                <div className="mt-2 text-center max-w-[80px]">
                  <p className={cn('text-[10px] leading-tight', styles.label)}>
                    {stage.label}
                  </p>
                  {stage.sublabel && (
                    <p className="mt-0.5 text-[9px] text-muted-foreground truncate max-w-[80px]">
                      {stage.sublabel}
                    </p>
                  )}
                  {stage.optional && stage.state === 'skipped' && (
                    <p className="mt-0.5 text-[9px] text-gray-400">optional</p>
                  )}
                </div>
              )}
            </div>
          )

          return (
            <div key={stage.label} className="flex items-center">
              {/* Stage */}
              <div className="flex flex-col items-center" title={compact ? stage.label : undefined}>
                {stage.href && stage.state !== 'pending' && stage.state !== 'skipped' ? (
                  <Link href={stage.href} className="hover:opacity-80 transition-opacity">
                    {content}
                  </Link>
                ) : content}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className={cn(
                  'flex-shrink-0 mx-1',
                  compact ? 'h-0.5 w-6' : 'h-0.5 w-8',
                  STATE_STYLES[stages[i + 1]?.state === 'completed' || stage.state === 'completed' ? 'completed' : 'pending'].connector
                )} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Helper: build stages for a Purchase Order ────────────────────────────────

type POStageInput = {
  poId: string
  poStatus: string
  prId?: string | null
  grnCount: number
  invoiceCount: number
  paidInvoiceCount: number
}

export function buildPOWorkflowStages(input: POStageInput): WorkflowStage[] {
  const { poId, poStatus, prId, grnCount, invoiceCount, paidInvoiceCount } = input

  const isCancelled = poStatus === 'CANCELLED'
  const poApproved = ['APPROVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED'].includes(poStatus)
  const grnDone = grnCount > 0
  const invoiceDone = invoiceCount > 0
  const paymentDone = paidInvoiceCount > 0

  return [
    {
      label: 'Purchase Request',
      sublabel: prId ? 'Approved' : undefined,
      state: prId ? 'completed' : 'skipped',
      href: prId ? `/procurement/purchase-requests/${prId}` : undefined,
      optional: true,
    },
    {
      label: 'Purchase Order',
      sublabel: poStatus.replace(/_/g, ' '),
      state: isCancelled ? 'rejected'
        : poApproved ? 'completed'
        : poStatus === 'PENDING_APPROVAL' ? 'current'
        : 'current',
      href: `/procurement/purchase-orders/${poId}`,
    },
    {
      label: 'Approval',
      state: isCancelled ? 'rejected'
        : poApproved ? 'completed'
        : poStatus === 'PENDING_APPROVAL' ? 'current'
        : 'pending',
    },
    {
      label: 'Goods Receipt',
      sublabel: grnDone ? `${grnCount} GRN${grnCount !== 1 ? 's' : ''}` : undefined,
      state: grnDone ? 'completed' : poApproved ? 'current' : 'pending',
      href: `/procurement/goods-receipt`,
    },
    {
      label: 'Supplier Invoice',
      sublabel: invoiceDone ? `${invoiceCount} invoice${invoiceCount !== 1 ? 's' : ''}` : undefined,
      state: invoiceDone ? 'completed' : grnDone ? 'current' : 'pending',
      href: `/procurement/purchase-invoices`,
    },
    {
      label: 'Payment',
      sublabel: paymentDone ? 'Paid' : undefined,
      state: paymentDone ? 'completed' : invoiceDone ? 'current' : 'pending',
    },
  ]
}

// ── Helper: build stages for a Purchase Requisition ──────────────────────────

type PRStageInput = {
  prId: string
  prStatus: string
  poId?: string | null
  poNumber?: string | null
  poStatus?: string | null
  rfqCount?: number
  grnCount?: number
  invoiceCount?: number
  paidCount?: number
}

export function buildPRWorkflowStages(input: PRStageInput): WorkflowStage[] {
  const { prId, prStatus, poId, poNumber, poStatus, rfqCount = 0, grnCount = 0, invoiceCount = 0, paidCount = 0 } = input

  const isRejected = prStatus === 'REJECTED'

  const prDone = ['APPROVED', 'PO_CREATED'].includes(prStatus) || !!poId
  const approvalDone = prDone && !isRejected
  const rfqDone = rfqCount > 0
  const poDone = !!poId && !!poStatus && !['DRAFT', 'PENDING_APPROVAL'].includes(poStatus)
  const grnDone = grnCount > 0
  const invoiceDone = invoiceCount > 0
  const paymentDone = paidCount > 0

  return [
    {
      label: 'Purchase Request',
      sublabel: undefined,
      state: isRejected ? 'rejected' : prDone ? 'completed' : prStatus === 'PENDING' ? 'current' : 'current',
      href: `/procurement/purchase-requests/${prId}`,
    },
    {
      label: 'Approval',
      sublabel: isRejected ? 'Rejected' : approvalDone ? 'Approved' : prStatus === 'PENDING' ? 'Pending' : undefined,
      state: isRejected ? 'rejected' : approvalDone ? 'completed' : prStatus === 'PENDING' ? 'current' : 'pending',
    },
    {
      label: 'RFQ',
      sublabel: rfqDone ? `${rfqCount} sent` : undefined,
      state: rfqDone ? 'completed' : approvalDone ? 'skipped' : 'pending',
      optional: true,
    },
    {
      label: 'Purchase Order',
      sublabel: poNumber ?? undefined,
      state: !poId ? (approvalDone ? 'current' : 'pending')
        : poStatus === 'PENDING_APPROVAL' ? 'current'
        : 'completed',
      href: poId ? `/procurement/purchase-orders/${poId}` : undefined,
    },
    {
      label: 'Goods Receipt',
      sublabel: grnDone ? `${grnCount} GRN(s)` : undefined,
      state: grnDone ? 'completed' : poDone ? 'current' : 'pending',
      href: poId ? `/procurement/goods-receipt` : undefined,
    },
    {
      label: 'Supplier Invoice',
      sublabel: invoiceDone ? `${invoiceCount} invoice(s)` : undefined,
      state: invoiceDone ? 'completed' : grnDone ? 'current' : 'pending',
      href: poId ? `/procurement/purchase-invoices` : undefined,
    },
    {
      label: 'Payment',
      sublabel: paymentDone ? 'Paid' : undefined,
      state: paymentDone ? 'completed' : invoiceDone ? 'current' : 'pending',
    },
  ]
}
