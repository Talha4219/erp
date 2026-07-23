'use client'
import { CrudListPage } from '@/components/shared/CrudListPage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'

type Quotation = { id: string; quotationNumber: string; quotationDate: string; expiryDate: string; status: string; totalAmount: number; customer: { name: string } }

export function PageClient({ initialData }: { initialData: Quotation[] }) {
  return (
    <CrudListPage<Quotation>
      title="Quotations"
      description="Manage sales quotations"
      queryKey={['quotations']}
      apiEndpoint="/api/sales/quotations"
      initialData={initialData}
      searchPlaceholder="Search quote # or customer…"
      searchFields={['quotationNumber', 'customer.name']}
      filters={[
        { key: 'status', label: 'Status' },
        { key: 'dateFrom', label: 'From', type: 'date' },
        { key: 'dateTo', label: 'To', type: 'date' },
      ]}
      filterFn={(item, _search, filters) => {
        if (filters.dateFrom && new Date(item.quotationDate) < new Date(filters.dateFrom)) return false
        if (filters.dateTo && new Date(item.quotationDate) > new Date(filters.dateTo)) return false
        return null
      }}
      columns={[
        { key: 'quotationNumber', header: 'Quote #', sortable: true },
        { key: 'customer.name', header: 'Customer', render: (r: Quotation) => r.customer.name },
        { key: 'quotationDate', header: 'Date', render: (r: Quotation) => formatDate(r.quotationDate) },
        { key: 'expiryDate', header: 'Expires', render: (r: Quotation) => formatDate(r.expiryDate) },
        { key: 'totalAmount', header: 'Amount', render: (r: Quotation) => formatCurrency(Number(r.totalAmount)) },
        { key: 'status', header: 'Status', render: (r: Quotation) => <Badge variant="secondary">{r.status}</Badge> },
      ]}
      addButtonHref="/sales/quotations/new"
      addButtonLabel="New Quotation"
      actions={(row) => (
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/sales/quotations/${row.id}`}><Eye className="h-4 w-4" /></Link>
        </Button>
      )}
    />
  )
}
