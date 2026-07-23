'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api-client'
import { cycleCountSchema, type CycleCountInput } from '@/lib/validations/inventory'
import type { Resolver } from 'react-hook-form'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, CheckCircle, X } from 'lucide-react'
import { useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { formatDate, itemDisplayName } from '@/lib/utils'

type CycleCount = {
  id: string
  countNumber: string
  warehouse: { name: string }
  countDate: string
  status: string
  lineItems: {
    id: string
    item: { name: string; packing: string | null; sku: string; uom: string }
    systemQty: number
    countedQty: number | null
    variance: number | null
    notes: string | null
  }[]
}
type Warehouse = { id: string; name: string }
type Item = { id: string; name: string; packing: string | null; sku: string }

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  DRAFT: 'secondary',
  IN_PROGRESS: 'default',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
}

export function PageClient({ initialData }: { initialData: CycleCount[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<CycleCount | null>(null)
  const [countInputs, setCountInputs] = useState<Record<string, string>>({})

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['cycle-counts'],
    queryFn: () => api.get<CycleCount[]>('/api/inventory/cycle-counts').then((r) => r.data ?? []),
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

  const { register, handleSubmit, setValue, reset, control, formState: { errors } } = useForm<CycleCountInput>({
    resolver: zodResolver(cycleCountSchema) as unknown as Resolver<CycleCountInput>,
    defaultValues: {
      countDate: new Date().toISOString().split('T')[0],
      lineItems: [{ itemId: '', systemQty: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const watchedLines = useWatch({ control, name: 'lineItems' })

  const mutation = useMutation({
    mutationFn: (d: CycleCountInput) => api.post('/api/inventory/cycle-counts', d),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['cycle-counts'] })
      const previous = qc.getQueryData(['cycle-counts'])
      qc.setQueryData(['cycle-counts'], (old: any[]) => [{ ...newData, id: 'temp-' + Date.now(), countNumber: '...', status: 'DRAFT', lineItems: [], warehouse: { name: '' } }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Cycle count created') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['cycle-counts'], context.previous); toast.error('Failed to create cycle count') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['cycle-counts'] }); setShowForm(false); reset() },
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, action, lineItems }: { id: string; action: string; lineItems?: { id: string; countedQty: number }[] }) =>
      api.put(`/api/inventory/cycle-counts/${id}`, { action, lineItems }),
    onMutate: async ({ id, action }) => {
      await qc.cancelQueries({ queryKey: ['cycle-counts'] })
      const previous = qc.getQueryData(['cycle-counts'])
      qc.setQueryData(['cycle-counts'], (old: any[]) => old.map((item: any) => item.id === id ? { ...item, status: action === 'complete' ? 'COMPLETED' : action === 'cancel' ? 'CANCELLED' : item.status } : item))
      return { previous, action }
    },
    onSuccess: (_, { action }) => { toast.success(action === 'complete' ? 'Cycle count completed — stock reconciled' : action === 'update-counts' ? 'Counts saved' : 'Cancelled') },
    onError: (err, vars, context) => { if (context?.previous) qc.setQueryData(['cycle-counts'], context.previous); toast.error('Action failed') },
    onSettled: (data, err, vars) => { qc.invalidateQueries({ queryKey: ['cycle-counts'] }); if (['complete', 'cancel'].includes(vars.action)) setDetail(null) },
  })

  const handleSaveCounts = () => {
    if (!detail) return
    const lineItems = detail.lineItems.map((l) => ({
      id: l.id,
      countedQty: parseFloat(countInputs[l.id] ?? String(l.countedQty ?? l.systemQty)),
    }))
    actionMutation.mutate({ id: detail.id, action: 'update-counts', lineItems })
  }

  const columns = [
    { key: 'countNumber', header: 'Count #', sortable: true },
    { key: 'warehouse', header: 'Warehouse', render: (r: CycleCount) => r.warehouse.name },
    { key: 'countDate', header: 'Date', render: (r: CycleCount) => formatDate(r.countDate) },
    { key: 'lineItems', header: 'Lines', render: (r: CycleCount) => r.lineItems.length },
    {
      key: 'status', header: 'Status',
      render: (r: CycleCount) => <Badge variant={STATUS_COLORS[r.status] ?? 'default'}>{r.status.replace('_', ' ')}</Badge>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cycle Counts"
        description="Count physical stock and reconcile variances against system quantities"
        actions={
          <Button onClick={() => { reset(); setShowForm(true) }}>
            <Plus className="mr-2 h-4 w-4" />New Count
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading} error={error}
        actions={(row) => (
          <Button variant="outline" size="sm" onClick={() => {
            setDetail(row)
            const inputs: Record<string, string> = {}
            row.lineItems.forEach((l) => { inputs[l.id] = String(l.countedQty ?? '') })
            setCountInputs(inputs)
          }}>
            {row.status === 'DRAFT' || row.status === 'IN_PROGRESS' ? 'Enter Counts' : 'View'}
          </Button>
        )}
      />

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) reset() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Cycle Count</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Warehouse *</Label>
                <Select onValueChange={(v) => setValue('warehouseId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.warehouseId && <p className="text-xs text-red-500">{errors.warehouseId.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Count Date *</Label>
                <Input {...register('countDate')} type="date" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input {...register('notes')} placeholder="Optional notes..." />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items to Count *</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: '', systemQty: 0 })}>
                  <Plus className="h-3 w-3 mr-1" />Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {fields.map((field, idx) => {
                  const sysQty = Number(watchedLines?.[idx]?.systemQty ?? 0)
                  const realQty = watchedLines?.[idx]?.countedQty != null ? Number(watchedLines[idx].countedQty) : null
                  const diff = realQty != null ? realQty - sysQty : null
                  return (
                    <div key={field.id} className="grid grid-cols-[1fr_90px_90px_70px_36px] gap-2 items-end">
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
                        {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">System Qty</Label>}
                        <Input {...register(`lineItems.${idx}.systemQty`, { valueAsNumber: true })} type="number" min="0" step="0.001" placeholder="0" />
                      </div>
                      <div>
                        {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Real Count</Label>}
                        <Input {...register(`lineItems.${idx}.countedQty`, { valueAsNumber: true })} type="number" min="0" step="0.001" placeholder="0" />
                      </div>
                      <div>
                        {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Difference</Label>}
                        <div className={`h-9 flex items-center justify-center rounded border bg-muted text-sm font-medium px-2 ${diff == null ? 'text-muted-foreground' : diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {diff == null ? '—' : (diff > 0 ? '+' : '') + diff.toFixed(3)}
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} disabled={fields.length === 1}>
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Creating...' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail/Count Entry Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cycle Count {detail?.countNumber} — {detail?.warehouse.name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Date: {formatDate(detail.countDate)}</span>
                <Badge variant={STATUS_COLORS[detail.status] ?? 'default'}>{detail.status.replace('_', ' ')}</Badge>
              </div>

              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-1.5">Item</th>
                    <th className="text-right py-1.5">System Qty</th>
                    <th className="text-right py-1.5">Counted Qty</th>
                    <th className="text-right py-1.5">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lineItems.map((l) => {
                    const counted = parseFloat(countInputs[l.id] ?? '')
                    const variance = isNaN(counted) ? null : counted - Number(l.systemQty)
                    return (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-1.5">
                          <div>{itemDisplayName(l.item)}</div>
                          <div className="text-xs text-muted-foreground">{l.item.sku} · {l.item.uom}</div>
                        </td>
                        <td className="text-right py-1.5">{Number(l.systemQty).toFixed(3)}</td>
                        <td className="text-right py-1.5">
                          {detail.status === 'COMPLETED' ? (
                            <span>{l.countedQty != null ? Number(l.countedQty).toFixed(3) : '—'}</span>
                          ) : (
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              value={countInputs[l.id] ?? ''}
                              onChange={(e) => setCountInputs((prev) => ({ ...prev, [l.id]: e.target.value }))}
                              className="w-24 text-right h-7 text-sm ml-auto"
                            />
                          )}
                        </td>
                        <td className={`text-right py-1.5 font-medium ${variance != null && variance !== 0 ? (variance > 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                          {detail.status === 'COMPLETED'
                            ? (l.variance != null ? (Number(l.variance) > 0 ? '+' : '') + Number(l.variance).toFixed(3) : '—')
                            : (variance != null ? (variance > 0 ? '+' : '') + variance.toFixed(3) : '—')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {detail.status !== 'COMPLETED' && detail.status !== 'CANCELLED' && (
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => actionMutation.mutate({ id: detail.id, action: 'cancel' })} disabled={actionMutation.isPending}>
                    <X className="h-4 w-4 mr-1" />Cancel Count
                  </Button>
                  <Button variant="outline" onClick={handleSaveCounts} disabled={actionMutation.isPending}>
                    Save Counts
                  </Button>
                  <Button onClick={() => actionMutation.mutate({ id: detail.id, action: 'complete' })} disabled={actionMutation.isPending}>
                    <CheckCircle className="h-4 w-4 mr-1" />Complete & Reconcile
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
