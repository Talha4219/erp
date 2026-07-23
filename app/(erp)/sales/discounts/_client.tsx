'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { CrudListPage, type CrudFormField } from '@/components/shared/CrudListPage'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

type Discount = { id: string; code: string; name: string; type: string; value: number; minOrderValue: number | null; maxUsage: number | null; usageCount: number; startDate: string | null; endDate: string | null; isActive: boolean }

const formFields: CrudFormField[] = [
  { name: 'code', label: 'Code', required: true },
  { name: 'name', label: 'Name', required: true },
  { name: 'type', label: 'Type', type: 'select', options: [{ value: 'PERCENTAGE', label: 'Percentage' }, { value: 'FIXED_AMOUNT', label: 'Fixed Amount' }] },
  { name: 'value', label: 'Value', type: 'number', required: true },
  { name: 'minOrderValue', label: 'Min Order Value (£)', type: 'number' },
  { name: 'maxUsage', label: 'Max Usage', type: 'number' },
  { name: 'startDate', label: 'Start Date', type: 'date' },
  { name: 'endDate', label: 'End Date', type: 'date' },
  { name: 'description', label: 'Description' },
]

export function PageClient({ initialData }: { initialData: Discount[] }) {
  const qc = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/api/sales/discounts/${id}`, { isActive }),
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: ['discounts'] })
      const previous = qc.getQueryData(['discounts'])
      qc.setQueryData(['discounts'], (old: any[]) => old.map((item: any) => item.id === id ? { ...item, isActive } : item))
      return { previous }
    },
    onError: (_err, _vars, context) => { if (context?.previous) qc.setQueryData(['discounts'], context.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['discounts'] }),
  })

  const columns: Column<Discount>[] = [
    { key: 'code', header: 'Code', sortable: true },
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type', render: (r) => <Badge variant="secondary">{r.type === 'PERCENTAGE' ? 'Percent' : 'Fixed'}</Badge> },
    { key: 'value', header: 'Value', render: (r) => r.type === 'PERCENTAGE' ? `${r.value}%` : `£${r.value}` },
    { key: 'minOrderValue', header: 'Min Order', render: (r) => r.minOrderValue ? `£${r.minOrderValue}` : '—' },
    { key: 'usage', header: 'Usage', render: (r) => r.maxUsage ? `${r.usageCount}/${r.maxUsage}` : `${r.usageCount}` },
    { key: 'endDate', header: 'Expires', render: (r) => r.endDate ? formatDate(r.endDate) : 'No expiry' },
    { key: 'isActive', header: 'Active', render: (r) => <Switch checked={r.isActive} onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, isActive: v })} /> },
  ]

  return (
    <CrudListPage<Discount>
      title="Discounts"
      description="Manage discount codes and rules"
      queryKey={['discounts']}
      apiEndpoint="/api/sales/discounts"
      initialData={initialData}
      columns={columns}
      formFields={formFields}
      addButtonLabel="Add Discount"
      onSave={async (data, id) => {
        const payload = {
          ...data,
          value: Number(data.value),
          minOrderValue: data.minOrderValue ? Number(data.minOrderValue) : null,
          maxUsage: data.maxUsage ? Number(data.maxUsage) : null,
        }
        if (id) await api.patch(`/api/sales/discounts/${id}`, payload)
        else await api.post('/api/sales/discounts', payload)
      }}
      onDelete={async (id) => { await api.delete(`/api/sales/discounts/${id}`) }}
      formTitle={(e) => e ? 'Edit Discount' : 'New Discount'}
    />
  )
}
