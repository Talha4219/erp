'use client'
import { api } from '@/lib/api-client'
import { CrudListPage, type CrudFormField } from '@/components/shared/CrudListPage'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'

type TaxRate = { id: string; code: string; name: string; taxType: string; rate: number; isDefault: boolean; isActive: boolean }

const TAX_TYPES = ['VAT', 'GST', 'SALES_TAX', 'WITHHOLDING', 'EXEMPT'] as const

const formFields: CrudFormField[] = [
  { name: 'code', label: 'Code', required: true },
  { name: 'name', label: 'Name', required: true },
  { name: 'taxType', label: 'Tax Type', type: 'select', options: TAX_TYPES.map((t) => ({ value: t, label: t })) },
  { name: 'rate', label: 'Rate (%)', type: 'number', required: true },
  { name: 'isDefault', label: 'Default', type: 'checkbox' },
  { name: 'isActive', label: 'Active', type: 'checkbox' },
]

const columns: Column<TaxRate>[] = [
  { key: 'code', header: 'Code', render: (row) => <span className="font-mono">{row.code}</span> },
  { key: 'name', header: 'Name' },
  { key: 'taxType', header: 'Type', render: (row) => <Badge variant="secondary">{row.taxType}</Badge> },
  { key: 'rate', header: 'Rate', render: (row) => <span className="font-semibold">{Number(row.rate).toFixed(2)}%</span> },
  { key: 'isDefault', header: 'Default', render: (row) => row.isDefault ? <Badge>Default</Badge> : null },
  { key: 'isActive', header: 'Status', render: (row) => <Badge variant={row.isActive ? 'default' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
]

export function PageClient({ initialData }: { initialData: TaxRate[] }) {
  return (
    <CrudListPage<TaxRate>
      title="Tax Rates"
      description="Configure VAT, GST, and other tax rates"
      queryKey={['tax-rates']}
      apiEndpoint="/api/finance/tax-rates"
      initialData={initialData}
      columns={columns}
      formFields={formFields}
      addButtonLabel="Add Tax Rate"
      onSave={async (data, id) => {
        const payload = { ...data, rate: Number(data.rate) }
        if (id) await api.put(`/api/finance/tax-rates/${id}`, payload)
        else await api.post('/api/finance/tax-rates', payload)
      }}
      onDelete={async (id) => { await api.delete(`/api/finance/tax-rates/${id}`) }}
      formTitle={(e) => (e ? 'Edit Tax Rate' : 'New Tax Rate')}
    />
  )
}
