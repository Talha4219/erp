'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Truck, User, Car, Package, ArrowLeftRight } from 'lucide-react'

const METHOD_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  COMPANY_DELIVERY: { label: 'Company Delivery', icon: Truck, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  CUSTOMER_PICKUP: { label: 'Customer Pickup', icon: User, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CUSTOMER_TRANSPORT: { label: 'Customer Transport', icon: Car, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  COURIER: { label: 'Courier', icon: Package, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  INTERNAL_TRANSFER: { label: 'Internal Transfer', icon: ArrowLeftRight, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
}

type Props = {
  method: string
  className?: string
}

export function FulfillmentMethodBadge({ method, className }: Props) {
  const config = METHOD_CONFIG[method]
  if (!config) return <Badge variant="outline">{method}</Badge>
  const Icon = config.icon
  return (
    <Badge variant="outline" className={cn('flex items-center gap-1 font-medium text-[11px] px-2 py-0.5', config.color, className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}
