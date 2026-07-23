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
import { Package, Eye, Plus, Search, X } from 'lucide-react'
import Link from 'next/link'

type CourierOrder = { id: string; fulfillmentNumber: string; customer: { name: string }; status: string; createdAt: string; courierShipments?: Array<{ courierName: string; trackingNumber: string | null; charges: number }> }

export function PageClient({ initialData }: { initialData: CourierOrder[] }) {
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['fulfillment-courier'],
    queryFn: () => api.get<CourierOrder[]>('/api/fulfillment/courier').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.fulfillmentNumber.toLowerCase().includes(q) || r.customer.name.toLowerCase().includes(q) || (r.courierShipments?.[0]?.trackingNumber && r.courierShipments[0].trackingNumber.toLowerCase().includes(q))
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Courier Shipments" description="Manage courier shipments" icon={Package} iconColor="text-purple-600"
        actions={<Button asChild><Link href="/fulfillment/orders/new"><Plus className="mr-2 h-4 w-4" />New Shipment</Link></Button>}
      />
      <div className="flex gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search shipments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {search && <Button variant="ghost" size="sm" onClick={() => setSearch('')}><X className="h-4 w-4 mr-1" />Clear</Button>}
      </div>
      <DataTable
        columns={[
          { key: 'fulfillmentNumber', header: 'Order #', sortable: true },
          { key: 'customer.name', header: 'Customer', render: (r: CourierOrder) => r.customer.name },
          { key: 'courierShipments.courierName', header: 'Courier', render: (r: CourierOrder) => r.courierShipments?.[0]?.courierName ?? '-' },
          { key: 'courierShipments.trackingNumber', header: 'Tracking #', render: (r: CourierOrder) => r.courierShipments?.[0]?.trackingNumber ?? '-' },
          { key: 'status', header: 'Status', render: (r: CourierOrder) => <FulfillmentStatusBadge status={r.status} /> },
          { key: 'createdAt', header: 'Created', render: (r: CourierOrder) => formatDate(r.createdAt) },
        ]}
        data={filtered}
        isLoading={isLoading} error={error}
        actions={(row) => (
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/fulfillment/courier/${row.id}`}><Eye className="h-4 w-4" /></Link>
          </Button>
        )}
      />
    </div>
  )
}
