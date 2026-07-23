'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { FulfillmentStatusBadge } from '@/components/modules/fulfillment/FulfillmentStatusBadge'
import { Input } from '@/components/ui/input'
import { User, Eye, Search, X } from 'lucide-react'
import Link from 'next/link'

type PickupOrder = { id: string; fulfillmentNumber: string; customer: { name: string }; status: string; pickupLocation: string; requestedDate: string }

export function PageClient({ initialData }: { initialData: PickupOrder[] }) {
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['fulfillment-pickups'],
    queryFn: () => api.get<PickupOrder[]>('/api/fulfillment/pickups').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.fulfillmentNumber.toLowerCase().includes(q) || r.customer.name.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Customer Pickups" description="Orders for customer pickup" icon={User} iconColor="text-emerald-600" />
      <div className="flex gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search pickups..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {search && <Button variant="ghost" size="sm" onClick={() => setSearch('')}><X className="h-4 w-4 mr-1" />Clear</Button>}
      </div>
      <DataTable
        columns={[
          { key: 'fulfillmentNumber', header: 'Order #', sortable: true },
          { key: 'customer.name', header: 'Customer', render: (r: PickupOrder) => r.customer.name },
          { key: 'status', header: 'Status', render: (r: PickupOrder) => <FulfillmentStatusBadge status={r.status} /> },
          { key: 'pickupLocation', header: 'Pickup Location' },
          { key: 'requestedDate', header: 'Date', render: (r: PickupOrder) => formatDate(r.requestedDate) },
        ]}
        data={filtered}
        isLoading={isLoading} error={error}
        actions={(row) => (
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/fulfillment/pickups/${row.id}`}><Eye className="h-4 w-4" /></Link>
          </Button>
        )}
      />
    </div>
  )
}
