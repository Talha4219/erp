'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api-client'
import { stockTransferSchema, type StockTransferInput } from '@/lib/validations/inventory'
import type { Resolver } from 'react-hook-form'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, itemDisplayName } from '@/lib/utils'

type Transfer = {
  id: string
  transferNumber: string
  fromWarehouse: { name: string }
  toWarehouse: { name: string }
  transferDate: string
  status: string
  lineItems: { id: string; item: { name: string; packing: string | null; sku: string }; quantity: number; unitCost: number }[]
}
type Warehouse = { id: string; name: string }
type Item = { id: string; name: string; packing: string | null; sku: string }

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  DRAFT: 'secondary',
  IN_TRANSIT: 'default',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
}

export function PageClient({ initialData }: { initialData: Transfer[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<Transfer | null>(null)

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['stock-transfers'],
    queryFn: () => api.get<Transfer[]>('/api/inventory/transfers').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get<Warehouse[]>('/api/inventory/warehouses').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { data: items = [] } = useQuery({
    queryKey: ['items-list'],
    queryFn: () => api.get<Item[]>('/api/inventory/items').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { register, handleSubmit, setValue, reset, control, formState: { errors } } = useForm<StockTransferInput>({
    resolver: zodResolver(stockTransferSchema) as unknown as Resolver<StockTransferInput>,
    defaultValues: {
      transferDate: new Date().toISOString().split('T')[0],
      lineItems: [{ itemId: '', quantity: 1, unitCost: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })

  const mutation = useMutation({
    mutationFn: (d: StockTransferInput) => api.post('/api/inventory/transfers', d),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['stock-transfers'] })
      const previous = qc.getQueryData(['stock-transfers'])
      qc.setQueryData(['stock-transfers'], (old: any[]) => [{ ...newData, id: 'temp-' + Date.now(), transferNumber: '...', status: 'DRAFT', lineItems: [], fromWarehouse: { name: '' }, toWarehouse: { name: '' } }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Transfer created') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['stock-transfers'], context.previous); toast.error('Failed to create transfer') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['stock-transfers'] }); setShowForm(false); reset() },
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.put(`/api/inventory/transfers/${id}`, { action }),
    onMutate: async ({ id, action }) => {
      await qc.cancelQueries({ queryKey: ['stock-transfers'] })
      const previous = qc.getQueryData(['stock-transfers'])
      qc.setQueryData(['stock-transfers'], (old: any[]) => old.map((item: any) => item.id === id ? { ...item, status: action === 'post' ? 'COMPLETED' : 'CANCELLED' } : item))
      return { previous }
    },
    onSuccess: (_, { action }) => { toast.success(action === 'post' ? 'Transfer posted — stock updated' : 'Transfer cancelled') },
    onError: (err, vars, context) => { if (context?.previous) qc.setQueryData(['stock-transfers'], context.previous); toast.error('Action failed') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['stock-transfers'] }); setDetail(null) },
  })

  const columns = [
    { key: 'transferNumber', header: 'Transfer #', sortable: true },
    { key: 'fromWarehouse', header: 'From', render: (r: Transfer) => r.fromWarehouse.name },
    { key: 'toWarehouse', header: 'To', render: (r: Transfer) => r.toWarehouse.name },
    { key: 'transferDate', header: 'Date', render: (r: Transfer) => formatDate(r.transferDate) },
    { key: 'lineItems', header: 'Lines', render: (r: Transfer) => r.lineItems.length },
    {
      key: 'status', header: 'Status',
      render: (r: Transfer) => <Badge variant={STATUS_COLORS[r.status] ?? 'default'}>{r.status.replace('_', ' ')}</Badge>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Transfers"
        description="Move inventory between warehouses"
        actions={
          <Button onClick={() => { reset(); setShowForm(true) }}>
            <Plus className="mr-2 h-4 w-4" />New Transfer
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading} error={error}
        actions={(row) => (
          <Button variant="outline" size="sm" onClick={() => setDetail(row)}>View</Button>
        )}
      />

      {/* Create Transfer Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) reset() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>From Warehouse *</Label>
                <Select onValueChange={(v) => setValue('fromWarehouseId', v)}>
                  <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.fromWarehouseId && <p className="text-xs text-red-500">{errors.fromWarehouseId.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>To Warehouse *</Label>
                <Select onValueChange={(v) => setValue('toWarehouseId', v)}>
                  <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.toWarehouseId && <p className="text-xs text-red-500">{errors.toWarehouseId.message}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Transfer Date</Label>
              <Input {...register('transferDate')} type="date" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input {...register('notes')} placeholder="Optional notes..." />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Line Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: '', quantity: 1, unitCost: 0 })}>
                  <Plus className="h-3 w-3 mr-1" />Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-[1fr_100px_100px_36px] gap-2 items-end">
                    <div>
                      {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Item</Label>}
                      <Select onValueChange={(v) => setValue(`lineItems.${idx}.itemId`, v)}>
                        <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>
                          {items.map((i) => <SelectItem key={i.id} value={i.id}>{itemDisplayName(i)} ({i.sku})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Qty</Label>}
                      <Input {...register(`lineItems.${idx}.quantity`, { valueAsNumber: true })} type="number" min="0.001" step="0.001" />
                    </div>
                    <div>
                      {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Unit Cost</Label>}
                      <Input {...register(`lineItems.${idx}.unitCost`, { valueAsNumber: true })} type="number" min="0" step="0.01" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} disabled={fields.length === 1}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Creating...' : 'Create Transfer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer {detail?.transferNumber}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">From:</span> {detail.fromWarehouse.name}</div>
                <div><span className="text-muted-foreground">To:</span> {detail.toWarehouse.name}</div>
                <div><span className="text-muted-foreground">Date:</span> {formatDate(detail.transferDate)}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={STATUS_COLORS[detail.status] ?? 'default'}>{detail.status.replace('_', ' ')}</Badge></div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-1">Item</th>
                    <th className="text-right py-1">Qty</th>
                    <th className="text-right py-1">Unit Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lineItems.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-1">{itemDisplayName(l.item)} <span className="text-muted-foreground text-xs">({l.item.sku})</span></td>
                      <td className="text-right py-1">{l.quantity}</td>
                      <td className="text-right py-1">{Number(l.unitCost).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail.status === 'DRAFT' && (
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => actionMutation.mutate({ id: detail.id, action: 'cancel' })} disabled={actionMutation.isPending}>
                    <X className="h-4 w-4 mr-1" />Cancel
                  </Button>
                  <Button onClick={() => actionMutation.mutate({ id: detail.id, action: 'post' })} disabled={actionMutation.isPending}>
                    <Send className="h-4 w-4 mr-1" />Post Transfer
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
