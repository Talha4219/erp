'use client'

import { StatCard } from '@/components/shared/StatCard'
import {
  ClipboardList, CheckCircle2, Truck,
  UserCheck, ArrowRight, RotateCcw,
} from 'lucide-react'

type KpiData = {
  ordersPending: number
  approvedOrders: number
  inTransit: number
  deliveriesToday: number
  awaitingPickup: number
  returns: number
}

type Props = {
  data: KpiData
}

export function KpiCards({ data }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <StatCard
        title="Pending"
        value={data.ordersPending}
        icon={ClipboardList}
        iconColor="text-blue-500"
        accent="bg-blue-500"
        description="Awaiting approval"
      />
      <StatCard
        title="Approved"
        value={data.approvedOrders}
        icon={CheckCircle2}
        iconColor="text-emerald-500"
        accent="bg-emerald-500"
        description="Ready to dispatch"
      />
      <StatCard
        title="In Transit"
        value={data.inTransit}
        icon={Truck}
        iconColor="text-cyan-500"
        accent="bg-cyan-500"
        description="On the move"
      />
      <StatCard
        title="Deliveries Today"
        value={data.deliveriesToday}
        icon={ArrowRight}
        iconColor="text-indigo-500"
        accent="bg-indigo-500"
        description="Out for delivery"
      />
      <StatCard
        title="Awaiting Pickup"
        value={data.awaitingPickup}
        icon={UserCheck}
        iconColor="text-violet-500"
        accent="bg-violet-500"
        description="Customer collection"
      />
      <StatCard
        title="Returns"
        value={data.returns}
        icon={RotateCcw}
        iconColor="text-rose-500"
        accent="bg-rose-500"
        description="Reverse logistics"
      />
    </div>
  )
}
