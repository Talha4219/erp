'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Plus, Eye, ShoppingBasket } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'

type SalesOrder = {
  id: string; orderNumber: string; channel: string; workflowStatus: string
  orderDate: string; totalAmount: number; customer: { name: string } | null
  legacyStandardId: string | null; legacyRetailId: number | null
}

const channelColors: Record<string, string> = {
  STANDARD: 'bg-blue-100 text-blue-800',
  POS: 'bg-purple-100 text-purple-800',
  ONLINE: 'bg-green-100 text-green-800',
  WHOLESALE: 'bg-amber-100 text-amber-800',
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-indigo-100 text-indigo-800',
  PICKING: 'bg-yellow-100 text-yellow-800',
  PACKED: 'bg-orange-100 text-orange-800',
  SHIPPED: 'bg-cyan-100 text-cyan-800',
  DELIVERED: 'bg-green-100 text-green-800',
  INVOICED: 'bg-teal-100 text-teal-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  REFUNDED: 'bg-rose-100 text-rose-800',
  VOIDED: 'bg-red-100 text-red-800',
}

export function SalesOrdersClient({ initialData }: { initialData: SalesOrder[] }) {
  const [search, setSearch] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const queryParams = filterChannel ? `?channel=${filterChannel}` : ''
  const { data, error } = useQuery({
    queryKey: ['sales-orders', filterChannel],
    queryFn: () => api.get<SalesOrder[]>(`/api/sales/orders${queryParams}`).then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
  })

  const workflowStatuses = Array.from(new Set((data ?? []).map((r) => r.workflowStatus)))
  const channels = Array.from(new Set((data ?? []).map((r) => r.channel)))

  const filtered = (data ?? []).filter((r) => {
    if (search) {
      const q = search.toLowerCase()
      if (!r.orderNumber.toLowerCase().includes(q) && !(r.customer?.name ?? '').toLowerCase().includes(q)) return false
    }
    if (filterStatus && r.workflowStatus !== filterStatus) return false
    if (filterFrom && new Date(r.orderDate) < new Date(filterFrom)) return false
    if (filterTo && new Date(r.orderDate) > new Date(filterTo)) return false
    return true
  })

  const hasFilters = search || filterChannel || filterStatus || filterFrom || filterTo

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="All sales orders across channels"
        actions={
          <Button asChild>
            <Link href="/sales/orders/new"><Plus className="mr-2 h-4 w-4" />New Order</Link>
          </Button>
        }
      />
      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Search order # or customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All channels" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            {channels.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            {workflowStatuses.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-40" />
        <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-40" />
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterChannel(''); setFilterStatus(''); setFilterFrom(''); setFilterTo('') }}>
            <X className="h-4 w-4 mr-1" />Clear
          </Button>
        )}
      </div>
      <DataTable
        columns={[
          { key: 'orderNumber', header: 'Order #', sortable: true },
          { key: 'customer.name', header: 'Customer', render: (r: SalesOrder) => r.customer?.name ?? 'Walk-in' },
          { key: 'channel', header: 'Channel', render: (r: SalesOrder) => <Badge className={channelColors[r.channel] ?? ''}>{r.channel}</Badge> },
          { key: 'orderDate', header: 'Date', render: (r: SalesOrder) => formatDate(r.orderDate) },
          { key: 'totalAmount', header: 'Amount', render: (r: SalesOrder) => formatCurrency(Number(r.totalAmount)) },
          { key: 'workflowStatus', header: 'Status', render: (r: SalesOrder) => <Badge className={statusColors[r.workflowStatus] ?? ''}>{r.workflowStatus.replace(/_/g, ' ')}</Badge> },
        ]}
        data={filtered}
        isLoading={false} error={error}
        virtualized
        actions={(row) => (
          <Button variant="ghost" size="icon" asChild>
            {row.channel === 'POS' ? (
              <Link href={`/pos?orderId=${row.legacyRetailId}`}><ShoppingBasket className="h-4 w-4" /></Link>
            ) : (
              <Link href={`/sales/orders/${row.legacyStandardId ?? row.id}`}><Eye className="h-4 w-4" /></Link>
            )}
          </Button>
        )}
      />
    </div>
  )
}
