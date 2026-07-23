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
import { RotateCcw, Eye, Plus, Search, X } from 'lucide-react'
import Link from 'next/link'

type Return = { id: string; returnNumber: string; fulfillmentNumber: string; customer: { name: string }; status: string; reason: string; createdAt: string }

export function PageClient({ initialData }: { initialData: Return[] }) {
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['fulfillment-returns'],
    queryFn: () => api.get<Return[]>('/api/fulfillment/returns').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.returnNumber.toLowerCase().includes(q) || r.fulfillmentNumber.toLowerCase().includes(q) || r.customer.name.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Returns" description="Manage return requests" icon={RotateCcw} iconColor="text-rose-600"
        actions={<Button asChild><Link href="/fulfillment/returns/new"><Plus className="mr-2 h-4 w-4" />New Return</Link></Button>}
      />
      <div className="flex gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search returns..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {search && <Button variant="ghost" size="sm" onClick={() => setSearch('')}><X className="h-4 w-4 mr-1" />Clear</Button>}
      </div>
      <DataTable
        columns={[
          { key: 'returnNumber', header: 'Return #', sortable: true },
          { key: 'fulfillmentNumber', header: 'Order #' },
          { key: 'customer.name', header: 'Customer', render: (r: Return) => r.customer.name },
          { key: 'reason', header: 'Reason' },
          { key: 'status', header: 'Status', render: (r: Return) => <FulfillmentStatusBadge status={r.status} /> },
          { key: 'createdAt', header: 'Created', render: (r: Return) => formatDate(r.createdAt) },
        ]}
        data={filtered}
        isLoading={isLoading} error={error}
        actions={(row) => (
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/fulfillment/returns/${row.id}`}><Eye className="h-4 w-4" /></Link>
          </Button>
        )}
      />
    </div>
  )
}
