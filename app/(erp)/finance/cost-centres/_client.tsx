'use client'

import { CrudListPage } from '@/components/shared/CrudListPage'
import type { CrudFormField } from '@/components/shared/CrudListPage'
import { api } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'

type CostCentre = { id: string; code: string; name: string; description?: string; isActive: boolean }

const formFields: CrudFormField[] = [
  { name: 'code', label: 'Code', type: 'text', required: true },
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'isActive', label: 'Active', type: 'checkbox' },
]

export function PageClient({ initialData }: { initialData: CostCentre[] }) {
  return (
    <CrudListPage<CostCentre>
      title="Cost Centres"
      description="Track costs by department or project"
      queryKey={['cost-centres']}
      apiEndpoint="/api/finance/cost-centres"
      initialData={initialData}
      columns={[
        { key: 'code', label: 'Code', render: (row: CostCentre) => <span className="font-mono">{row.code}</span> },
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description', render: (row: CostCentre) => <span className="text-muted-foreground text-sm">{row.description ?? '—'}</span> },
        { key: 'isActive', label: 'Status', render: (row: CostCentre) => <Badge variant={row.isActive ? 'default' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
      ]}
      onSave={async (data, id) => {
        if (id) return api.put(`/api/finance/cost-centres/${id}`, data)
        return api.post('/api/finance/cost-centres', data)
      }}
      onDelete={async (id) => api.delete(`/api/finance/cost-centres/${id}`)}
      formFields={formFields}
      addButtonLabel="Add Cost Centre"
    />
  )
}
