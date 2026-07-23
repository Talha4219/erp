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
import { Eye, Plus } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'

type Invoice = { id: string; invoiceNumber: string; customer: { name: string }; invoiceDate: string; dueDate: string; totalAmount: number; paidAmount: number; status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' }

const statusVariant: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'secondary'> = {
  PAID: 'success', OVERDUE: 'destructive', PARTIALLY_PAID: 'warning', SENT: 'info', DRAFT: 'secondary', CANCELLED: 'secondary',
}

export function PageClient({ initialData }: { initialData: Invoice[] }) {
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<Invoice[]>('/api/sales/invoices').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false
    if (filterFrom && new Date(r.invoiceDate) < new Date(filterFrom)) return false
    if (filterTo && new Date(r.invoiceDate) > new Date(filterTo)) return false
    return true
  })

  const columns = [
    { key: 'invoiceNumber', header: 'Invoice #', sortable: true },
    { key: 'customer', header: 'Customer', render: (r: Invoice) => r.customer.name },
    { key: 'invoiceDate', header: 'Date', render: (r: Invoice) => formatDate(r.invoiceDate) },
    { key: 'dueDate', header: 'Due Date', render: (r: Invoice) => r.dueDate ? formatDate(r.dueDate) : '-' },
    { key: 'totalAmount', header: 'Amount', render: (r: Invoice) => formatCurrency(Number(r.totalAmount)) },
    { key: 'paidAmount', header: 'Paid', render: (r: Invoice) => formatCurrency(Number(r.paidAmount)) },
    {
      key: 'balance', header: 'Balance',
      render: (r: Invoice) => {
        const balance = Number(r.totalAmount) - Number(r.paidAmount)
        return <span className={balance > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>{formatCurrency(balance)}</span>
      },
    },
    { key: 'status', header: 'Status', render: (r: Invoice) => <Badge variant={statusVariant[r.status] ?? 'secondary'}>{r.status.replace(/_/g, ' ')}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Invoices" description="Manage customer invoices and payments"
        actions={<Button asChild><Link href="/sales/invoices/new"><Plus className="mr-2 h-4 w-4" />New Invoice</Link></Button>}
      />
      <div className="flex gap-3 flex-wrap mb-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            {['DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED'].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-40" placeholder="From" />
        <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-40" placeholder="To" />
        {(filterStatus || filterFrom || filterTo) && (
          <Button variant="outline" size="sm" onClick={() => { setFilterStatus(''); setFilterFrom(''); setFilterTo('') }}>Clear</Button>
        )}
      </div>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} error={error} virtualized
        actions={(row) => (
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/sales/invoices/${row.id}`}><Eye className="h-4 w-4" /></Link>
          </Button>
        )}
      />
    </div>
  )
}
