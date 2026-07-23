'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { serialNumberSchema, type SerialNumberInput } from '@/lib/validations/inventory'
import { CrudListPage } from '@/components/shared/CrudListPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { QrCode } from 'lucide-react'
import { formatDate, itemDisplayName } from '@/lib/utils'
import { toast } from 'sonner'

type Serial = {
  id: string
  serialCode: string
  item: { id: string; name: string; packing: string | null; sku: string }
  warehouse: { id: string; name: string } | null
  status: string
  purchaseDate: string | null
  warrantyExpiry: string | null
  notes: string | null
}

type Item = { id: string; name: string; packing: string | null; sku: string }
type Warehouse = { id: string; name: string }

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  IN_STOCK: 'success',
  SOLD: 'default',
  RETURNED: 'secondary',
  SCRAPPED: 'destructive',
}

function SerialForm({ editing, onSave, onCancel, isPending }: {
  editing: Serial | null
  onSave: (data: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const { data: items = [] } = useQuery({
    queryKey: ['items-list'],
    queryFn: () => api.get<Item[]>('/api/inventory/items').then((r) => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get<Warehouse[]>('/api/inventory/warehouses').then((r) => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<SerialNumberInput>({
    resolver: zodResolver(serialNumberSchema) as unknown as Resolver<SerialNumberInput>,
  })

  useEffect(() => {
    if (editing) {
      reset({
        serialCode: editing.serialCode,
        itemId: editing.item.id,
        warehouseId: editing.warehouse?.id ?? '',
        purchaseDate: editing.purchaseDate ? editing.purchaseDate.split('T')[0] : '',
        warrantyExpiry: editing.warrantyExpiry ? editing.warrantyExpiry.split('T')[0] : '',
        notes: editing.notes ?? '',
      })
    } else {
      reset()
    }
  }, [editing, reset])

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="space-y-1">
        <Label>Serial Code / Barcode <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input {...register('serialCode')} placeholder="Scan barcode or leave blank to auto-generate" className="font-mono" />
        {errors.serialCode && <p className="text-xs text-red-500">{errors.serialCode.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>Item *</Label>
        <Select onValueChange={(v) => setValue('itemId', v)}>
          <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
          <SelectContent>
            {items.map((i) => <SelectItem key={i.id} value={i.id}>{itemDisplayName(i)} ({i.sku})</SelectItem>)}
          </SelectContent>
        </Select>
        {errors.itemId && <p className="text-xs text-red-500">{errors.itemId.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>Warehouse</Label>
        <Select onValueChange={(v) => setValue('warehouseId', v)}>
          <SelectTrigger><SelectValue placeholder="Select warehouse (optional)" /></SelectTrigger>
          <SelectContent>
            {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Purchase Date</Label>
          <Input {...register('purchaseDate')} type="date" />
        </div>
        <div className="space-y-1">
          <Label>Warranty Expiry</Label>
          <Input {...register('warrantyExpiry')} type="date" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Notes</Label>
        <Input {...register('notes')} placeholder="Optional notes..." />
      </div>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Registering...' : 'Register'}</Button>
      </DialogFooter>
    </form>
  )
}

export function PageClient({ initialData }: { initialData: Serial[] }) {
  const qc = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/api/inventory/serial-numbers/${id}`, { status }),
    onSuccess: () => {
      toast.success('Status updated')
      qc.invalidateQueries({ queryKey: ['serial-numbers'] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  const columns = [
    {
      key: 'serialCode', header: 'Serial / Barcode', sortable: true,
      render: (r: Serial) => (
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm">{r.serialCode}</span>
        </div>
      ),
    },
    { key: 'item', header: 'Item', render: (r: Serial) => `${itemDisplayName(r.item)} (${r.item.sku})` },
    { key: 'warehouse', header: 'Warehouse', render: (r: Serial) => r.warehouse?.name ?? '—' },
    {
      key: 'status', header: 'Status',
      render: (r: Serial) => <Badge variant={STATUS_COLORS[r.status] ?? 'default'}>{r.status.replace('_', ' ')}</Badge>,
    },
    { key: 'purchaseDate', header: 'Purchase Date', render: (r: Serial) => r.purchaseDate ? formatDate(r.purchaseDate) : '—' },
    { key: 'warrantyExpiry', header: 'Warranty Expiry', render: (r: Serial) => r.warrantyExpiry ? formatDate(r.warrantyExpiry) : '—' },
  ]

  return (
    <CrudListPage<Serial>
      title="Serial Numbers"
      description="Track serialised items for warranty, barcode scanning, and traceability"
      queryKey={['serial-numbers']}
      apiEndpoint="/api/inventory/serial-numbers"
      initialData={initialData}
      columns={columns}
      searchPlaceholder="Search serial code or item…"
      searchFields={['serialCode', 'item.name', 'item.sku']}
      filters={[
        {
          key: 'status',
          label: 'Status',
          getOptions: (data: Serial[]) =>
            Array.from(new Set(data.map((s) => s.status))).map((v) => ({ value: v, label: v.replace(/_/g, ' ') })),
        },
        {
          key: 'item.id',
          label: 'Item',
          getOptions: (data: Serial[]) =>
            Array.from(new Map(data.map((s) => [s.item.id, { value: s.item.id, label: `${itemDisplayName(s.item)} (${s.item.sku})` }])).values()),
        },
      ]}
      onSave={async (data, id) => {
        if (id) return api.put(`/api/inventory/serial-numbers/${id}`, data)
        return api.post('/api/inventory/serial-numbers', data)
      }}
      FormComponent={SerialForm}
      addButtonLabel="Register Serial"
      actions={(row) => (
        <Select value={row.status} onValueChange={(v) => statusMutation.mutate({ id: row.id, status: v })}>
          <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="IN_STOCK">In Stock</SelectItem>
            <SelectItem value="SOLD">Sold</SelectItem>
            <SelectItem value="RETURNED">Returned</SelectItem>
            <SelectItem value="SCRAPPED">Scrapped</SelectItem>
          </SelectContent>
        </Select>
      )}
    />
  )
}
