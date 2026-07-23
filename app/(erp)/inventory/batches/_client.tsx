'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api-client'
import { itemBatchSchema, itemBatchAdjustSchema, type ItemBatchInput, type ItemBatchAdjustInput } from '@/lib/validations/inventory'
import { daysUntilExpiry } from '@/lib/uk-locale'
import { itemDisplayName } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, AlertTriangle, ArrowDownCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Resolver } from 'react-hook-form'

type ERPItem = {
  id: string
  sku: string
  name: string
  packing?: string | null
  uom: string
  reorderPoint: number
}

type Batch = {
  id: number
  batchNumber: string
  manufacturingDate: string | null
  expiryDate: string | null
  quantityOnHand: number
  receivedDate: string
  item: ERPItem | null
}

type LowStockRow = {
  id: string
  sku: string
  name: string
  category: string
  reorderPoint: number
  totalQty: number
}

function expiryBadge(expiryDate: string | null) {
  if (!expiryDate) return <Badge className="bg-gray-100 text-gray-600 border-0">No Expiry</Badge>
  const days = daysUntilExpiry(expiryDate)
  if (days === null) return null
  if (days < 0)  return <Badge className="bg-red-600 text-white border-0">Expired</Badge>
  if (days <= 7)  return <Badge className="bg-red-100 text-red-800 border-0">{days}d — Critical</Badge>
  if (days <= 14) return <Badge className="bg-orange-100 text-orange-800 border-0">{days}d — Amber</Badge>
  if (days <= 30) return <Badge className="bg-yellow-100 text-yellow-800 border-0">{days}d — Monitor</Badge>
  return <Badge className="bg-green-100 text-green-800 border-0">{days}d</Badge>
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function PageClient({ initialData }: { initialData: Batch[] }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [showAdjForm, setShowAdjForm] = useState(false)
  const [selectedBatchNum, setSelectedBatchNum] = useState('')

  const { data: batches = [], isLoading, error: batchesError } = useQuery({
    queryKey: ['inv-batches', tab],
    queryFn: () => {
      const base = '/api/inventory/batches'
      if (tab === 'expiry7')  return api.get<Batch[]>(`${base}?expiryDays=7`).then((r) => r.data ?? [])
      if (tab === 'expiry14') return api.get<Batch[]>(`${base}?expiryDays=14`).then((r) => r.data ?? [])
      if (tab === 'expiry30') return api.get<Batch[]>(`${base}?expiryDays=30`).then((r) => r.data ?? [])
      return api.get<Batch[]>(base).then((r) => r.data ?? [])
    },
    initialData: tab === 'all' ? initialData : undefined,
    staleTime: tab === 'all' ? 30_000 : 0,
    placeholderData: (previousData) => previousData,
  })

  const { data: lowStock = [], error: lowStockError } = useQuery({
    queryKey: ['inv-low-stock'],
    queryFn: () => api.get<LowStockRow[]>('/api/inventory/batches?lowStock=true').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: () => api.get<ERPItem[]>('/api/inventory/items').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { register: regBatch, handleSubmit: hsBatch, reset: resetBatch, setValue: setBatchVal, formState: { errors: batchErr } } =
    useForm<ItemBatchInput>({ resolver: zodResolver(itemBatchSchema) as unknown as Resolver<ItemBatchInput> })

  const { register: regAdj, handleSubmit: hsAdj, reset: resetAdj, setValue: setAdjVal, formState: { errors: adjErr } } =
    useForm<ItemBatchAdjustInput>({ resolver: zodResolver(itemBatchAdjustSchema) as unknown as Resolver<ItemBatchAdjustInput> })

  const batchMutation = useMutation({
    mutationFn: (d: ItemBatchInput) => api.post('/api/inventory/batches', d),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['inv-batches'] })
      const previous = qc.getQueryData(['inv-batches'])
      qc.setQueryData(['inv-batches'], (old: any[]) => [{ ...newData, id: Date.now(), batchNumber: newData.batchNumber, manufacturingDate: newData.manufacturingDate ?? null, expiryDate: newData.expiryDate ?? null, quantityOnHand: newData.quantityOnHand, receivedDate: newData.receivedDate ?? new Date().toISOString(), item: null }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Batch registered') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['inv-batches'], context.previous); toast.error('Failed to register batch') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['inv-batches'] }); qc.invalidateQueries({ queryKey: ['inv-low-stock'] }); setShowBatchForm(false); resetBatch() },
  })

  const adjMutation = useMutation({
    mutationFn: (d: ItemBatchAdjustInput) => api.post('/api/inventory/batches/adjust', d),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['inv-batches'] })
      const previous = qc.getQueryData(['inv-batches'])
      qc.setQueryData(['inv-batches'], (old: any[]) => old.map((item: any) => item.id === newData.batchId ? { ...item, quantityOnHand: item.quantityOnHand + newData.quantityChange } : item))
      return { previous }
    },
    onSuccess: () => { toast.success('Adjustment saved') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['inv-batches'], context.previous); toast.error('Failed to save adjustment') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['inv-batches'] }); qc.invalidateQueries({ queryKey: ['inv-low-stock'] }); setShowAdjForm(false); resetAdj() },
  })

  const batchColumns = [
    { key: 'batchNumber', header: 'Batch No.' },
    {
      key: 'item',
      header: 'Item',
      render: (row: Batch) => row.item
        ? <span>{itemDisplayName(row.item)} <span className="text-muted-foreground text-xs">({row.item.sku})</span></span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'quantityOnHand',
      header: 'Qty on Hand',
      render: (row: Batch) => {
        const rp = Number(row.item?.reorderPoint ?? 0)
        const qty = row.quantityOnHand
        return (
          <span className={qty === 0 ? 'text-red-600 font-semibold' : qty <= rp ? 'text-amber-600 font-semibold' : ''}>
            {qty} {row.item?.uom ?? ''}
          </span>
        )
      },
    },
    { key: 'manufacturingDate', header: 'Mfg. Date', render: (row: Batch) => fmtDate(row.manufacturingDate) },
    { key: 'receivedDate', header: 'Received', render: (row: Batch) => fmtDate(row.receivedDate) },
    {
      key: 'expiryDate',
      header: 'Expiry / FEFO Status',
      render: (row: Batch) => (
        <div className="flex items-center gap-2">
          <span className="text-sm">{fmtDate(row.expiryDate)}</span>
          {expiryBadge(row.expiryDate)}
        </div>
      ),
    },
    {
      key: 'adjust',
      header: '',
      render: (row: Batch) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setSelectedBatchNum(row.batchNumber)
            setAdjVal('batchId', row.id)
            setShowAdjForm(true)
          }}
        >
          <ArrowDownCircle className="h-4 w-4 mr-1" />Adjust
        </Button>
      ),
    },
  ]

  const lowStockColumns = [
    { key: 'sku', header: 'SKU' },
    { key: 'name', header: 'Item Name' },
    { key: 'category', header: 'Category' },
    { key: 'reorderPoint', header: 'Reorder Pt.' },
    {
      key: 'totalQty',
      header: 'Batch Total Qty',
      render: (row: LowStockRow) => (
        <span className={`font-bold ${row.totalQty === 0 ? 'text-red-600' : 'text-amber-600'}`}>
          {row.totalQty}
        </span>
      ),
    },
  ]

  const filteredBatches = search
    ? batches.filter((b) =>
        b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
        b.item?.name.toLowerCase().includes(search.toLowerCase()) ||
        b.item?.sku.toLowerCase().includes(search.toLowerCase())
      )
    : batches

  return (
    <>
      <PageHeader
        title="Inventory Batch Management"
        description="FEFO expiry tracking, low stock alerts, and stock adjustments by batch"
        actions={
          <Button onClick={() => setShowBatchForm(true)}>
            <Plus className="h-4 w-4 mr-1" />Register Batch
          </Button>
        }
      />

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Search batch #, item name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80"
        />
        {search && <Button variant="outline" size="sm" onClick={() => setSearch('')}>Clear</Button>}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All Batches</TabsTrigger>
          <TabsTrigger value="expiry7" className="text-red-600">Expiry ≤7 Days</TabsTrigger>
          <TabsTrigger value="expiry14" className="text-orange-500">Expiry ≤14 Days</TabsTrigger>
          <TabsTrigger value="expiry30" className="text-yellow-600">Expiry ≤30 Days</TabsTrigger>
          <TabsTrigger value="lowstock">
            <AlertTriangle className="h-4 w-4 mr-1 text-amber-500" />Low Stock ({lowStock.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <DataTable columns={batchColumns} data={filteredBatches} isLoading={isLoading} error={batchesError} virtualized />
        </TabsContent>
        <TabsContent value="expiry7">
          <DataTable columns={batchColumns} data={filteredBatches} isLoading={isLoading} error={batchesError} virtualized />
        </TabsContent>
        <TabsContent value="expiry14">
          <DataTable columns={batchColumns} data={filteredBatches} isLoading={isLoading} error={batchesError} virtualized />
        </TabsContent>
        <TabsContent value="expiry30">
          <DataTable columns={batchColumns} data={filteredBatches} isLoading={isLoading} error={batchesError} virtualized />
        </TabsContent>
        <TabsContent value="lowstock">
          <DataTable columns={lowStockColumns} data={lowStock} isLoading={false} error={lowStockError} />
        </TabsContent>
      </Tabs>

      {/* Register Batch Dialog */}
      <Dialog open={showBatchForm} onOpenChange={(o) => { if (!o) { setShowBatchForm(false); resetBatch() } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Register New Batch</DialogTitle></DialogHeader>
          <form onSubmit={hsBatch((d) => batchMutation.mutate(d))} className="space-y-3">
            <div className="space-y-1">
              <Label>Item *</Label>
              <Select onValueChange={(v) => setBatchVal('itemId', v)}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {itemDisplayName(i)} <span className="text-muted-foreground ml-1">({i.sku})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {batchErr.itemId && <p className="text-xs text-red-500">{batchErr.itemId.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Batch Number *</Label>
              <Input {...regBatch('batchNumber')} placeholder="e.g. LOT-20240101" />
              {batchErr.batchNumber && <p className="text-xs text-red-500">{batchErr.batchNumber.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quantity *</Label>
                <Input {...regBatch('quantityOnHand', { valueAsNumber: true })} type="number" min={0} />
                {batchErr.quantityOnHand && <p className="text-xs text-red-500">{batchErr.quantityOnHand.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Received Date</Label>
                <Input {...regBatch('receivedDate')} type="date" />
              </div>
              <div className="space-y-1">
                <Label>Manufacturing Date</Label>
                <Input {...regBatch('manufacturingDate')} type="date" />
              </div>
              <div className="space-y-1">
                <Label>Expiry Date <span className="text-muted-foreground font-normal">(FEFO)</span></Label>
                <Input {...regBatch('expiryDate')} type="date" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBatchForm(false)}>Cancel</Button>
              <Button type="submit" disabled={batchMutation.isPending}>
                {batchMutation.isPending ? 'Saving…' : 'Register Batch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={showAdjForm} onOpenChange={(o) => { if (!o) { setShowAdjForm(false); resetAdj() } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock — {selectedBatchNum}</DialogTitle>
          </DialogHeader>
          <form onSubmit={hsAdj((d) => adjMutation.mutate(d))} className="space-y-3">
            <input type="hidden" {...regAdj('batchId', { valueAsNumber: true })} />
            <div className="space-y-1">
              <Label>Quantity Change *</Label>
              <Input {...regAdj('quantityChange', { valueAsNumber: true })} type="number" placeholder="Negative for wastage/loss" />
              {adjErr.quantityChange && <p className="text-xs text-red-500">{adjErr.quantityChange.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Reason *</Label>
              <Select onValueChange={(v) => setAdjVal('reason', v as ItemBatchAdjustInput['reason'])}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  {['Expired', 'Damaged', 'Stock Count', 'Theft', 'Found'].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {adjErr.reason && <p className="text-xs text-red-500">{adjErr.reason.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Adjusted By</Label>
              <Input {...regAdj('adjustedBy')} placeholder="Your name" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdjForm(false)}>Cancel</Button>
              <Button type="submit" disabled={adjMutation.isPending}>
                {adjMutation.isPending ? 'Saving…' : 'Save Adjustment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
