'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import { api } from '@/lib/api-client'
import { warehouseSchema, type WarehouseInput } from '@/lib/validations/inventory'
import { CrudListPage } from '@/components/shared/CrudListPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

type WarehouseRow = { id: string; code: string; name: string; address: string | null; isActive: boolean; _count?: { stocks: number } }

function WarehouseForm({ editing, onSave, onCancel, isPending }: {
  editing: WarehouseRow | null
  onSave: (data: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<WarehouseInput>({
    resolver: zodResolver(warehouseSchema) as unknown as Resolver<WarehouseInput>,
  })

  useEffect(() => { if (editing) reset({ code: editing.code, name: editing.name, address: editing.address ?? '' }); else reset() }, [editing, reset])

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Code *</Label>
          <Input {...register('code')} placeholder="WH-001" />
          {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Name *</Label>
          <Input {...register('name')} placeholder="Main Warehouse" />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>
      </div>
      <div className="space-y-1">
        <Label>Address</Label>
        <Input {...register('address')} placeholder="123 Industrial Estate, London" />
      </div>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : editing ? 'Update' : 'Create'}</Button>
      </DialogFooter>
    </form>
  )
}

export function PageClient({ initialData }: { initialData: WarehouseRow[] }) {
  const columns = [
    { key: 'code', header: 'Code', sortable: true },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'address', header: 'Address', render: (r: WarehouseRow) => r.address ?? '—' },
    { key: 'isActive', header: 'Status', render: (r: WarehouseRow) => <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
  ]

  return (
    <CrudListPage<WarehouseRow>
      title="Warehouses"
      description="Manage warehouse locations for multi-location stock control"
      queryKey={['warehouses']}
      apiEndpoint="/api/inventory/warehouses"
      initialData={initialData}
      columns={columns}
      onSave={async (data, id) => {
        if (id) return api.put(`/api/inventory/warehouses/${id}`, data)
        return api.post('/api/inventory/warehouses', data)
      }}
      onDelete={async (id) => api.delete(`/api/inventory/warehouses/${id}`)}
      FormComponent={WarehouseForm}
      addButtonLabel="Add Warehouse"
    />
  )
}
