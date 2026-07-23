'use client'
import { api } from '@/lib/api-client'
import { CrudListPage, type CrudFormField } from '@/components/shared/CrudListPage'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'

type Currency = { id: string; code: string; name: string; symbol: string; exchangeRate: number; isBase: boolean; isActive: boolean }

const formFields: CrudFormField[] = [
  { name: 'code', label: 'ISO Code', required: true },
  { name: 'name', label: 'Name', required: true },
  { name: 'symbol', label: 'Symbol', required: true },
  { name: 'exchangeRate', label: 'Exchange Rate (to base)', type: 'number', required: true },
  { name: 'isBase', label: 'Base currency', type: 'checkbox' },
  { name: 'isActive', label: 'Active', type: 'checkbox' },
]

const columns: Column<Currency>[] = [
  { key: 'code', header: 'Code', render: (row) => <span className="font-mono font-semibold">{row.code}</span> },
  { key: 'name', header: 'Currency' },
  { key: 'symbol', header: 'Symbol', render: (row) => <span className="font-bold text-lg">{row.symbol}</span> },
  { key: 'exchangeRate', header: 'Rate to Base', render: (row) => <span className="tabular-nums">{row.isBase ? '1.000000 (base)' : Number(row.exchangeRate).toFixed(6)}</span> },
  { key: 'isBase', header: 'Base', render: (row) => row.isBase ? <Badge>Base</Badge> : null },
  { key: 'isActive', header: 'Status', render: (row) => <Badge variant={row.isActive ? 'default' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
]

export function PageClient({ initialData }: { initialData: Currency[] }) {
  return (
    <CrudListPage<Currency>
      title="Currencies"
      description="Manage currencies and exchange rates"
      queryKey={['currencies']}
      apiEndpoint="/api/finance/currencies"
      initialData={initialData}
      columns={columns}
      formFields={formFields}
      addButtonLabel="Add Currency"
      onSave={async (data, id) => {
        const payload = { ...data, exchangeRate: data.isBase ? 1 : Number(data.exchangeRate) }
        if (id) await api.put(`/api/finance/currencies/${id}`, payload)
        else await api.post('/api/finance/currencies', payload)
      }}
      onDelete={async (id) => { await api.delete(`/api/finance/currencies/${id}`) }}
      formTitle={(e) => (e ? 'Edit Currency' : 'Add Currency')}
    />
  )
}
