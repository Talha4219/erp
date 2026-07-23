'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CrudListPage } from '@/components/shared/CrudListPage'
import type { CrudFormField } from '@/components/shared/CrudListPage'
import { api } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

type LeaveType = {
  id: string
  code: string
  name: string
  daysPerYear: number
  isPaid: boolean
  carryForward: boolean
  maxCarryDays: number
  description: string | null
  isActive: boolean
}

const formFields: CrudFormField[] = [
  { name: 'code', label: 'Code', type: 'text', required: true },
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'daysPerYear', label: 'Days Per Year', type: 'number', required: true },
  { name: 'isPaid', label: 'Paid Leave', type: 'checkbox' },
  { name: 'carryForward', label: 'Allow Carry Forward', type: 'checkbox' },
  { name: 'maxCarryDays', label: 'Max Carry Forward Days', type: 'number' },
  { name: 'description', label: 'Description', type: 'textarea' },
]

export function PageClient({ initialData }: { initialData: LeaveType[] }) {
  const qc = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/api/hr/leave-types/${id}`, { isActive }),
    onSuccess: () => {
      toast.success('Status updated')
      qc.invalidateQueries({ queryKey: ['leave-types'] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  return (
    <CrudListPage<LeaveType>
      title="Leave Types"
      description="Configure leave types and entitlements"
      queryKey={['leave-types']}
      apiEndpoint="/api/hr/leave-types"
      initialData={initialData}
      columns={[
        { key: 'code', header: 'Code', sortable: true },
        { key: 'name', header: 'Name', sortable: true },
        { key: 'daysPerYear', header: 'Days / Year', render: (r: LeaveType) => `${r.daysPerYear} days` },
        { key: 'isPaid', header: 'Paid', render: (r: LeaveType) => <Badge variant={r.isPaid ? 'success' : 'secondary'}>{r.isPaid ? 'Paid' : 'Unpaid'}</Badge> },
        { key: 'carryForward', header: 'Carry Forward', render: (r: LeaveType) => r.carryForward ? `Yes (max ${r.maxCarryDays}d)` : 'No' },
        { key: 'description', header: 'Description', render: (r: LeaveType) => r.description ?? '-' },
      ]}
      actions={(row: LeaveType) => (
        <Switch
          checked={row.isActive}
          onCheckedChange={(v) => toggleMutation.mutate({ id: row.id, isActive: v })}
        />
      )}
      onSave={async (data, id) => {
        if (id) return api.put(`/api/hr/leave-types/${id}`, data)
        return api.post('/api/hr/leave-types', data)
      }}
      onDelete={async (id) => api.delete(`/api/hr/leave-types/${id}`)}
      formFields={formFields}
      addButtonLabel="Add Leave Type"
    />
  )
}
