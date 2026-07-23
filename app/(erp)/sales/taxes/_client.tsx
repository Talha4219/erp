'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { CrudListPage } from '@/components/shared/CrudListPage'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

type TaxRate = { id: string; code: string; name: string; rate: number; description: string | null; isDefault: boolean; isActive: boolean }

export function PageClient({ initialData }: { initialData: TaxRate[] }) {
  const qc = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/api/sales/tax-rates/${id}`, { isActive }),
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: ['tax-rates'] })
      const previous = qc.getQueryData<TaxRate[]>(['tax-rates'])
      qc.setQueryData<TaxRate[]>(['tax-rates'], (old) =>
        old?.map((r) => (r.id === id ? { ...r, isActive } : r)) ?? []
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['tax-rates'], context.previous)
      toast.error('Failed to toggle')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tax-rates'] }),
  })

  return (
    <CrudListPage<TaxRate>
      title="Tax Rates"
      description="Manage VAT and other tax rates"
      queryKey={['tax-rates']}
      apiEndpoint="/api/sales/tax-rates"
      initialData={initialData}
      columns={[
        { key: 'code', header: 'Code', sortable: true },
        { key: 'name', header: 'Name' },
        { key: 'rate', header: 'Rate', render: (r: TaxRate) => `${r.rate}%` },
        { key: 'description', header: 'Description', render: (r: TaxRate) => r.description ?? '—' },
        { key: 'isDefault', header: 'Default', render: (r: TaxRate) => r.isDefault ? <Badge variant="success">Default</Badge> : null },
        { key: 'isActive', header: 'Active', render: (r: TaxRate) => <Switch checked={r.isActive} onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, isActive: v })} /> },
      ]}
      addButtonLabel="Add Tax Rate"
      onSave={async (data, id) => {
        if (id) return api.patch(`/api/sales/tax-rates/${id}`, data)
        return api.post('/api/sales/tax-rates', data)
      }}
      onDelete={async (id) => api.delete(`/api/sales/tax-rates/${id}`)}
      formFields={[
        { name: 'code', label: 'Code', required: true, placeholder: 'VAT20' },
        { name: 'name', label: 'Name', required: true, placeholder: 'UK VAT Standard Rate' },
        { name: 'rate', label: 'Rate (%)', type: 'number', required: true },
        { name: 'description', label: 'Description' },
        { name: 'isDefault', label: 'Set as default', type: 'checkbox' },
      ]}
    />
  )
}
