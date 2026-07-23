'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { FulfillmentStatusBadge } from '@/components/modules/fulfillment/FulfillmentStatusBadge'
import { FulfillmentMethodBadge } from '@/components/modules/fulfillment/FulfillmentMethodBadge'
import { FulfillmentFilters } from '@/components/modules/fulfillment/FulfillmentFilters'
import { Plus, Eye } from 'lucide-react'
import Link from 'next/link'

type FulfillmentOrder = { id: string; fulfillmentNumber: string; customer: { id: string; name: string }; method: string; status: string; priority: string; requestedDate: string; createdAt: string }

export function PageClient({ initialData }: { initialData: FulfillmentOrder[] }) {
  const [filters, setFilters] = useState({ search: '', status: '', method: '', priority: '' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['fulfillment-orders', filters],
    queryFn: () => api.get<FulfillmentOrder[]>('/api/fulfillment/orders').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((r) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!r.fulfillmentNumber.toLowerCase().includes(q) && !r.customer.name.toLowerCase().includes(q)) return false
    }
    if (filters.status && r.status !== filters.status) return false
    if (filters.method && r.method !== filters.method) return false
    if (filters.priority && r.priority !== filters.priority) return false
    return true
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fulfillment Orders"
        description="Manage fulfillment orders across all methods"
        actions={
          <Button asChild>
            <Link href="/fulfillment/orders/new"><Plus className="mr-2 h-4 w-4" />New Order</Link>
          </Button>
        }
      />
      <FulfillmentFilters onFiltersChange={setFilters} />
      <DataTable
        columns={[
          { key: 'fulfillmentNumber', header: 'Order #', sortable: true },
          { key: 'customer.name', header: 'Customer', render: (r: FulfillmentOrder) => r.customer.name },
          { key: 'method', header: 'Method', render: (r: FulfillmentOrder) => <FulfillmentMethodBadge method={r.method} /> },
          { key: 'status', header: 'Status', render: (r: FulfillmentOrder) => <FulfillmentStatusBadge status={r.status} /> },
          { key: 'priority', header: 'Priority' },
          { key: 'requestedDate', header: 'Requested Date', render: (r: FulfillmentOrder) => formatDate(r.requestedDate) },
          { key: 'createdAt', header: 'Created', render: (r: FulfillmentOrder) => formatDate(r.createdAt) },
        ]}
        data={filtered}
        isLoading={isLoading} error={error}
        actions={(row) => (
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/fulfillment/orders/${row.id}`}><Eye className="h-4 w-4" /></Link>
          </Button>
        )}
      />
    </div>
  )
}
