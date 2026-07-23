'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api-client'
import { stockAdjustmentSchema, type StockAdjustmentInput } from '@/lib/validations/inventory'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatCurrency, itemDisplayName } from '@/lib/utils'

type LedgerEntry = {
  id: string
  item: { name: string; packing: string | null; sku: string }
  warehouse: { name: string }
  transactionType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
  quantity: number
  unitCost: number
  totalCost: number
  transactionDate: string
  notes: string | null
}

type Item = { id: string; name: string; packing: string | null; sku: string; standardCost: number }
type Warehouse = { id: string; name: string }

export function PageClient({ initialData }: { initialData: LedgerEntry[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-ledger'],
    queryFn: () => api.get<LedgerEntry[]>('/api/inventory/stock').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })

  const { data: items } = useQuery({
    queryKey: ['items-list'],
    queryFn: () => api.get<Item[]>('/api/inventory/items').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get<Warehouse[]>('/api/inventory/warehouses').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { register, handleSubmit, setValue, reset } = useForm<StockAdjustmentInput>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      quantity: 0,
      unitCost: 0,
      transactionType: 'IN',
      transactionDate: new Date().toISOString().split('T')[0],
    },
  })

  const mutation = useMutation({
    mutationFn: (data: StockAdjustmentInput) => api.post('/api/inventory/stock', data),
    onSuccess: () => {
      toast.success('Stock entry created')
      qc.invalidateQueries({ queryKey: ['stock-ledger'] })
      qc.invalidateQueries({ queryKey: ['items'] })
      setShowForm(false)
      reset()
    },
    onError: () => toast.error('Failed to create stock entry'),
  })

  const columns = [
    { key: 'transactionDate', header: 'Date', render: (r: LedgerEntry) => formatDate(r.transactionDate) },
    { key: 'item', header: 'Item', render: (r: LedgerEntry) => `${itemDisplayName(r.item)} (${r.item.sku})` },
    { key: 'warehouse', header: 'Warehouse', render: (r: LedgerEntry) => r.warehouse.name },
    { key: 'transactionType', header: 'Type' },
    { key: 'quantity', header: 'Qty' },
    { key: 'unitCost', header: 'Unit Cost', render: (r: LedgerEntry) => formatCurrency(Number(r.unitCost)) },
    { key: 'totalCost', header: 'Total Cost', render: (r: LedgerEntry) => formatCurrency(Number(r.totalCost)) },
    { key: 'notes', header: 'Notes', render: (r: LedgerEntry) => r.notes ?? '-' },
  ]

  const filtered = (data ?? []).filter((r) => {
    if (search) {
      const q = search.toLowerCase()
      if (!r.item.name.toLowerCase().includes(q) && !r.item.sku.toLowerCase().includes(q)) return false
    }
    if (filterType && r.transactionType !== filterType) return false
    if (filterFrom && new Date(r.transactionDate) < new Date(filterFrom)) return false
    if (filterTo && new Date(r.transactionDate) > new Date(filterTo)) return false
    return true
  })

  const hasFilters = search || filterType || filterFrom || filterTo

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Ledger"
        description="View all stock transactions and create stock entries"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />Stock Entry
          </Button>
        }
      />

      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Search item or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            <SelectItem value="IN">In (Receipt)</SelectItem>
            <SelectItem value="OUT">Out (Issue)</SelectItem>
            <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
            <SelectItem value="TRANSFER">Transfer</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-40" />
        <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-40" />
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterType(''); setFilterFrom(''); setFilterTo('') }}>Clear</Button>
        )}
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} error={error} virtualized />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Stock Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label>Transaction Type</Label>
              <Select defaultValue="IN" onValueChange={(v) => setValue('transactionType', v as StockAdjustmentInput['transactionType'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">In (Receipt)</SelectItem>
                  <SelectItem value="OUT">Out (Issue)</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Item</Label>
              <Select onValueChange={(v) => {
                setValue('itemId', v)
                const selected = (items ?? []).find((i) => i.id === v)
                if (selected) setValue('unitCost', Number(selected.standardCost))
              }}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {(items ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{itemDisplayName(i)} ({i.sku})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Warehouse</Label>
              <Select onValueChange={(v) => setValue('warehouseId', v)}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {(warehouses ?? []).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input {...register('quantity', { valueAsNumber: true })} type="number" step="0.001" min="0" />
              </div>
              <div className="space-y-1">
                <Label>Unit Cost</Label>
                <Input {...register('unitCost', { valueAsNumber: true })} type="number" min="0" step="0.01" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Transaction Date</Label>
              <Input {...register('transactionDate')} type="date" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
