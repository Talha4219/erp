'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  PICKING: 'bg-amber-50 text-amber-700 border-amber-200',
  PACKING: 'bg-orange-50 text-orange-700 border-orange-200',
  PACKED: 'bg-purple-50 text-purple-700 border-purple-200',
  READY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PLANNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  DISPATCHED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  IN_TRANSIT: 'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED: 'bg-green-50 text-green-700 border-green-200',
  AWAITING_PICKUP: 'bg-violet-50 text-violet-700 border-violet-200',
  COLLECTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  AWAITING_COLLECTION: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  RELEASED: 'bg-teal-50 text-teal-700 border-teal-200',
  HANDED_TO_COURIER: 'bg-pink-50 text-pink-700 border-pink-200',
  DELAYED: 'bg-red-50 text-red-700 border-red-200',
  FAILED: 'bg-red-100 text-red-800 border-red-300',
  RETURNED: 'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED: 'bg-gray-200 text-gray-500 border-gray-300',
  PARTIALLY_FULFILLED: 'bg-yellow-50 text-yellow-700 border-yellow-200',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  PICKING: 'Picking',
  PACKING: 'Packing',
  PACKED: 'Packed',
  READY: 'Ready',
  PLANNED: 'Planned',
  DISPATCHED: 'Dispatched',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  AWAITING_PICKUP: 'Awaiting Pickup',
  COLLECTED: 'Collected',
  AWAITING_COLLECTION: 'Awaiting Collection',
  RELEASED: 'Released',
  HANDED_TO_COURIER: 'Handed to Courier',
  DELAYED: 'Delayed',
  FAILED: 'Failed',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
  PARTIALLY_FULFILLED: 'Partially Fulfilled',
}

type Props = {
  status: string
  className?: string
}

export function FulfillmentStatusBadge({ status, className }: Props) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'
  const label = STATUS_LABELS[status] ?? status
  return (
    <Badge variant="outline" className={cn('font-medium text-[11px] px-2 py-0.5', style, className)}>
      {label}
    </Badge>
  )
}
