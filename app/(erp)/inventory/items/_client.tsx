'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api-client'
import { itemSchema, type ItemInput } from '@/lib/validations/inventory'
import type { Resolver } from 'react-hook-form'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ExcelImport, type ImportResult } from '@/components/shared/ExcelImport'
import { Plus, Pencil, Trash2, Upload, ToggleLeft, ToggleRight, FolderPlus, AlertTriangle, CalendarClock, Printer, Barcode as BarcodeIcon } from 'lucide-react'
import { BarcodeSvg } from '@/components/shared/BarcodeSvg'
import { code128SvgString } from '@/lib/barcode'
import { toast } from 'sonner'
import { formatCurrency, itemDisplayName } from '@/lib/utils'
import { cn } from '@/lib/utils'

type WarehouseStock = {
  warehouse: { id: string; name: string }
  quantity: number
}

type Item = {
  id: string
  sku: string
  barcode: string | null
  barcodeType: string
  secondaryBarcode: string | null
  name: string
  description: string | null
  category: { name: string } | null
  uom: string
  packing: string | null
  reorderPoint: number
  reorderQty: number
  standardCost: number
  sellingPrice: number
  vatRate: number
  expiryDate: string | null
  isActive: boolean
  warehouseStocks: WarehouseStock[]
}

type Category = { id: string; name: string }
type Warehouse = { id: string; name: string; isActive: boolean }

function totalQty(item: Item) {
  return (item.warehouseStocks ?? []).reduce((s, ws) => s + Number(ws.quantity), 0)
}

function expiryStatus(expiryDate: string | null): 'expired' | 'soon' | 'ok' | 'none' {
  if (!expiryDate) return 'none'
  const now = new Date()
  const exp = new Date(expiryDate)
  if (exp < now) return 'expired'
  const daysLeft = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return daysLeft <= 30 ? 'soon' : 'ok'
}

function formatExpiry(expiryDate: string | null) {
  if (!expiryDate) return null
  return new Date(expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function PageClient({ initialData }: { initialData: Item[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [filterStock, setFilterStock] = useState<'low' | 'expiring' | ''>('')
  const [formWarehouseId, setFormWarehouseId] = useState<string>('')
  const [formQuantity, setFormQuantity] = useState<number>(0)
  const [showCatDialog, setShowCatDialog] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [formCategoryId, setFormCategoryId] = useState<string>('')
  const [formBarcodeType, setFormBarcodeType] = useState<string>('CODE128')
  const [printItem, setPrintItem] = useState<Item | null>(null)
  const [printQty, setPrintQty] = useState(1)

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/api/inventory/items/${id}`, { isActive }),
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: ['items'] })
      const previous = qc.getQueryData(['items'])
      qc.setQueryData(['items'], (old: any[]) => old.map((item: any) => item.id === id ? { ...item, isActive } : item))
      return { previous }
    },
    onSuccess: () => { toast.success('Status updated') },
    onError: (err, vars, context) => { if (context?.previous) qc.setQueryData(['items'], context.previous); toast.error('Failed to update status') },
    onSettled: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['items'],
    queryFn: () => api.get<Item[]>('/api/inventory/items').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })

  const allItems = data ?? []

  const lowStockCount = allItems.filter((i) => {
    const qty = totalQty(i)
    return qty <= Number(i.reorderPoint)
  }).length

  const expiringCount = allItems.filter((i) => {
    const s = expiryStatus(i.expiryDate)
    return s === 'soon' || s === 'expired'
  }).length

  const filtered = allItems.filter((i) => {
    if (search) {
      const q = search.toLowerCase()
      if (!itemDisplayName(i).toLowerCase().includes(q) && !i.sku.toLowerCase().includes(q) && !(i.barcode ?? '').toLowerCase().includes(q)) return false
    }
    if (filterCat && i.category?.name !== filterCat) return false
    if (filterActive === 'active' && !i.isActive) return false
    if (filterActive === 'inactive' && i.isActive) return false
    if (filterStock === 'low') {
      const qty = totalQty(i)
      if (qty > Number(i.reorderPoint)) return false
    }
    if (filterStock === 'expiring') {
      const s = expiryStatus(i.expiryDate)
      if (s !== 'soon' && s !== 'expired') return false
    }
    return true
  })

  const { data: categories } = useQuery({
    queryKey: ['item-categories'],
    queryFn: () => api.get<Category[]>('/api/inventory/categories').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => api.get<Warehouse[]>('/api/inventory/warehouses').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema) as unknown as Resolver<ItemInput>,
    defaultValues: { standardCost: 0, sellingPrice: 0, vatRate: 0.2, reorderPoint: 0, reorderQty: 0 } as Partial<ItemInput>,
  })

  const catMutation = useMutation({
    mutationFn: (name: string) => api.post<Category>('/api/inventory/categories', { name }),
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: ['item-categories'] })
      const previous = qc.getQueryData(['item-categories'])
      qc.setQueryData(['item-categories'], (old: any[]) => [{ id: 'temp-' + Date.now(), name }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: (res) => {
      toast.success('Category created')
      const id = res.data?.id
      if (id) { setFormCategoryId(id); setValue('categoryId', id) }
    },
    onError: (err, name, context) => { if (context?.previous) qc.setQueryData(['item-categories'], context.previous); toast.error('Failed to create category') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['item-categories'] }); setNewCatName(''); setShowCatDialog(false) },
  })

  const mutation = useMutation({
    mutationFn: async (data: ItemInput) => {
      const payload = {
        ...data,
        warehouseId: formWarehouseId || undefined,
        quantity: !editing && formWarehouseId ? formQuantity : undefined,
      }
      const res = editing ? await api.put(`/api/inventory/items/${editing.id}`, payload) : await api.post('/api/inventory/items', payload)
      if (!res.success) throw new Error(res.error ?? 'Failed to save item')
      return res
    },
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['items'] })
      const previous = qc.getQueryData(['items'])
      qc.setQueryData(['items'], (old: any[]) =>
        editing
          ? old.map((item) => (item.id === editing.id ? { ...item, ...newData } : item))
          : [{ ...newData, id: 'temp-' + Date.now(), isActive: true, warehouseStocks: [], category: null, barcode: null, secondaryBarcode: null, barcodeType: 'CODE128', packing: null, description: null, expiryDate: null }, ...(old ?? [])]
      )
      return { previous }
    },
    onSuccess: () => { toast.success(editing ? 'Item updated' : 'Item created') },
    onError: (err: Error, _newData, context) => { if (context?.previous) qc.setQueryData(['items'], context.previous); toast.error(err.message || 'Failed to save item') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['items'] }); setShowForm(false); reset({} as ItemInput); setEditing(null); setFormWarehouseId('') },
  })

  const printLabels = (labelItems: Array<{ name: string; sku: string; barcode: string | null }>, copies = 1) => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const content = labelItems
      .flatMap((it) => {
        const svg = it.barcode ? code128SvgString(it.barcode, { height: 44 }) : null
        if (!svg) return []
        return Array.from({ length: copies }, () =>
          `<div class="label"><p>${esc(it.name)}</p><p class="sku">${esc(it.sku)}</p>${svg}</div>`)
      })
      .join('')
    if (!content) { toast.error('No barcodes to print'); return }
    const win = window.open('', '_blank', 'width=450,height=600')
    if (!win) { toast.error('Allow pop-ups to print labels'); return }
    win.document.write(`<!doctype html><html><head><title>Barcode Labels</title><style>
      body { margin: 0; padding: 8mm; font-family: system-ui, sans-serif; }
      .labels { display: flex; flex-wrap: wrap; gap: 4mm; }
      .label { border: 1px solid #ccc; border-radius: 4px; padding: 8px 12px; text-align: center; page-break-inside: avoid; }
      .label p { margin: 0 0 2px; font-size: 12px; }
      .label .sku { color: #666; font-size: 10px; font-family: monospace; }
      @media print { .label { border-color: #eee } }
    </style></head><body><div class="labels">${content}</div></body></html>`)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/inventory/items/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['items'] })
      const previous = qc.getQueryData(['items'])
      qc.setQueryData(['items'], (old: any[]) => old.filter((item) => item.id !== id))
      return { previous }
    },
    onSuccess: () => { toast.success('Item disabled') },
    onError: (err, id, context) => { if (context?.previous) qc.setQueryData(['items'], context.previous); toast.error('Failed to disable') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['items'] }); setDeleteId(null) },
  })

  const columns = [
    { key: 'sku', header: 'SKU', sortable: true },
    {
      key: 'barcode',
      header: 'Barcode',
      render: (r: Item) =>
        r.barcode
          ? <span className="font-mono text-xs">{r.barcode}</span>
          : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: 'name',
      header: 'Item Name',
      sortable: true,
      render: (r: Item) => (
        <span>
          {r.name}
          {r.packing && <span className="text-muted-foreground"> ({r.packing})</span>}
        </span>
      ),
    },
    { key: 'category', header: 'Category', render: (r: Item) => r.category?.name ?? '-' },
    { key: 'uom', header: 'UOM' },
    {
      key: 'qty',
      header: 'Qty on Hand',
      render: (r: Item) => {
        const qty = totalQty(r)
        const rp = Number(r.reorderPoint)
        const isZero = qty === 0
        const isLow = qty > 0 && qty <= rp
        return (
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'font-medium tabular-nums',
              isZero && 'text-red-600',
              isLow && 'text-amber-600',
            )}>
              {qty.toFixed(3)}
            </span>
            {isZero && <Badge variant="destructive" className="text-[10px] px-1 py-0">Out</Badge>}
            {isLow && <Badge variant="warning" className="text-[10px] px-1 py-0 bg-amber-100 text-amber-700 border-amber-300">Low</Badge>}
          </div>
        )
      },
    },
    {
      key: 'reorderPoint',
      header: 'Reorder Pt.',
      render: (r: Item) => <span className="tabular-nums text-muted-foreground">{Number(r.reorderPoint).toFixed(0)}</span>,
    },
    {
      key: 'expiryDate',
      header: 'Expiry (FEFO)',
      render: (r: Item) => {
        const status = expiryStatus(r.expiryDate)
        if (status === 'none') return <span className="text-muted-foreground">—</span>
        const label = formatExpiry(r.expiryDate)!
        if (status === 'expired') return (
          <div className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-xs font-medium">{label}</span>
            <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-0.5">Expired</Badge>
          </div>
        )
        if (status === 'soon') return (
          <div className="flex items-center gap-1 text-amber-600">
            <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-xs font-medium">{label}</span>
            <Badge variant="warning" className="text-[10px] px-1 py-0 ml-0.5 bg-amber-100 text-amber-700 border-amber-300">Soon</Badge>
          </div>
        )
        return <span className="text-xs text-green-700">{label}</span>
      },
    },
    { key: 'standardCost', header: 'Cost', render: (r: Item) => formatCurrency(Number(r.standardCost)) },
    { key: 'sellingPrice', header: 'Price', render: (r: Item) => formatCurrency(Number(r.sellingPrice)) },
    {
      key: 'warehouseStocks',
      header: 'Warehouse',
      render: (r: Item) => {
        const stocks = r.warehouseStocks ?? []
        if (stocks.length === 0) return <span className="text-muted-foreground text-xs">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {stocks.map((ws) => (
              <Badge key={ws.warehouse.id} variant="outline" className="text-xs">
                {ws.warehouse.name}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (r: Item) => (
        <button
          onClick={() => statusMutation.mutate({ id: r.id, isActive: !r.isActive })}
          className="flex items-center gap-1 group"
          title={r.isActive ? 'Click to disable' : 'Click to enable'}
        >
          {r.isActive
            ? <ToggleRight className="h-5 w-5 text-green-500 group-hover:text-green-600" />
            : <ToggleLeft className="h-5 w-5 text-gray-400 group-hover:text-gray-500" />}
          <Badge variant={r.isActive ? 'success' : 'secondary'} className="pointer-events-none">
            {r.isActive ? 'Active' : 'Disabled'}
          </Badge>
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Items"
        description="Manage item master"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              title="Print one barcode label for each item in the current list"
              onClick={() => printLabels(filtered)}
            >
              <Printer className="mr-2 h-4 w-4" />Print Labels
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)}><Upload className="mr-2 h-4 w-4" />Import Excel</Button>
            <Button onClick={() => { setEditing(null); reset(); setFormWarehouseId(''); setFormQuantity(0); setFormCategoryId(''); setFormBarcodeType('CODE128'); setShowForm(true) }}><Plus className="mr-2 h-4 w-4" />Add Item</Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <Input placeholder="Search SKU, barcode or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {(categories ?? []).map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {/* Quick-filter chips */}
        <button
          onClick={() => setFilterStock(filterStock === 'low' ? '' : 'low')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
            filterStock === 'low'
              ? 'bg-amber-100 border-amber-400 text-amber-800'
              : 'border-muted-foreground/30 text-muted-foreground hover:border-amber-400 hover:text-amber-700',
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Low Stock
          {lowStockCount > 0 && (
            <span className={cn(
              'ml-0.5 rounded-full px-1.5 text-[10px] font-bold',
              filterStock === 'low' ? 'bg-amber-600 text-white' : 'bg-amber-200 text-amber-800',
            )}>{lowStockCount}</span>
          )}
        </button>

        <button
          onClick={() => setFilterStock(filterStock === 'expiring' ? '' : 'expiring')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
            filterStock === 'expiring'
              ? 'bg-red-100 border-red-400 text-red-800'
              : 'border-muted-foreground/30 text-muted-foreground hover:border-red-400 hover:text-red-700',
          )}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Expiring / Expired
          {expiringCount > 0 && (
            <span className={cn(
              'ml-0.5 rounded-full px-1.5 text-[10px] font-bold',
              filterStock === 'expiring' ? 'bg-red-600 text-white' : 'bg-red-200 text-red-800',
            )}>{expiringCount}</span>
          )}
        </button>

        {(search || filterCat || filterActive || filterStock) && (
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterCat(''); setFilterActive(''); setFilterStock('') }}>
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading} error={error}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditing(row)
                const primaryWarehouse = row.warehouseStocks?.[0]?.warehouse?.id ?? ''
                setFormWarehouseId(primaryWarehouse)
                const catId = row.category ? (categories ?? []).find((c) => c.name === row.category?.name)?.id ?? '' : ''
                setFormCategoryId(catId)
                setFormBarcodeType(row.barcodeType || 'CODE128')
                reset({
                  sku: row.sku,
                  barcode: row.barcode ?? undefined,
                  barcodeType: (row.barcodeType || 'CODE128') as ItemInput['barcodeType'],
                  secondaryBarcode: row.secondaryBarcode ?? undefined,
                  name: row.name,
                  description: row.description ?? undefined,
                  uom: row.uom,
                  packing: row.packing ?? undefined,
                  standardCost: Number(row.standardCost),
                  sellingPrice: Number(row.sellingPrice),
                  vatRate: Number(row.vatRate),
                  reorderPoint: Number(row.reorderPoint),
                  reorderQty: Number(row.reorderQty),
                  categoryId: catId || undefined,
                  expiryDate: row.expiryDate ? row.expiryDate.slice(0, 10) : undefined,
                })
                setShowForm(true)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title={row.barcode ? 'Print barcode label' : 'No barcode assigned'}
              disabled={!row.barcode}
              onClick={() => { setPrintQty(1); setPrintItem(row) }}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      {/* Add / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditing(null); setFormWarehouseId(''); setFormQuantity(0); setFormCategoryId('') } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Item' : 'Add Item'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">

            {/* ── Basic Info ── */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Basic Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Item Name</Label>
                  <Input {...register('name')} placeholder="e.g. Stainless Steel Bolt M8" />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <textarea
                    {...register('description')}
                    className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Optional description or notes about this item"
                  />
                </div>
                <div className="space-y-1">
                  <Label>SKU <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input {...register('sku')} placeholder="Auto-generated if left blank" />
                  {errors.sku && <p className="text-xs text-red-500">{errors.sku.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>UOM</Label>
                  <Input {...register('uom')} placeholder="Nos, Kg, Ltr..." />
                  {errors.uom && <p className="text-xs text-red-500">{errors.uom.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Packing <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input {...register('packing')} placeholder="e.g. 2kg, 500g, 12x1L" />
                  <p className="text-xs text-muted-foreground">Shown with the name, e.g. Beans (2kg)</p>
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <div className="flex gap-2">
                    <Select value={formCategoryId} onValueChange={(v) => { setFormCategoryId(v); setValue('categoryId', v) }}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" title="Add category" onClick={() => setShowCatDialog(true)}>
                      <FolderPlus className="h-4 w-4" />
                    </Button>
                  </div>
                  {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId.message}</p>}
                </div>
              </div>
            </div>

            {/* ── Barcodes ── */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Barcodes</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Barcode <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="relative">
                    <BarcodeIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input {...register('barcode')} className="pl-8 font-mono" placeholder="Auto-generated if left blank" />
                  </div>
                  {errors.barcode && <p className="text-xs text-red-500">{errors.barcode.message}</p>}
                  <p className="text-xs text-muted-foreground">One barcode = one product. Leave blank for an auto-generated EAN-13.</p>
                </div>
                <div className="space-y-1">
                  <Label>Barcode Type</Label>
                  <Select value={formBarcodeType} onValueChange={(v) => { setFormBarcodeType(v); setValue('barcodeType', v as ItemInput['barcodeType']) }}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CODE128">Code 128</SelectItem>
                      <SelectItem value="EAN13">EAN-13</SelectItem>
                      <SelectItem value="EAN8">EAN-8</SelectItem>
                      <SelectItem value="UPCA">UPC-A</SelectItem>
                      <SelectItem value="UPCE">UPC-E</SelectItem>
                      <SelectItem value="CODE39">Code 39</SelectItem>
                      <SelectItem value="QR">QR Code</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Secondary Barcode <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input {...register('secondaryBarcode')} className="font-mono" placeholder="e.g. supplier barcode or case barcode" />
                </div>
              </div>
            </div>

            {/* ── Pricing ── */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pricing &amp; Tax</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Standard Cost</Label>
                  <Input {...register('standardCost', { valueAsNumber: true })} type="number" step="0.01" min="0" />
                </div>
                <div className="space-y-1">
                  <Label>Selling Price</Label>
                  <Input {...register('sellingPrice', { valueAsNumber: true })} type="number" step="0.01" min="0" />
                </div>
                <div className="space-y-1">
                  <Label>VAT Rate <span className="text-muted-foreground font-normal">(0.20 = 20%)</span></Label>
                  <Input {...register('vatRate', { valueAsNumber: true })} type="number" step="0.01" min="0" max="1" />
                  <p className="text-xs text-muted-foreground">Applied on POS sale</p>
                </div>
              </div>
            </div>

            {/* ── Stock ── */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Stock Management</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Reorder Point</Label>
                  <Input {...register('reorderPoint', { valueAsNumber: true })} type="number" step="1" min="0" />
                  <p className="text-xs text-muted-foreground">Low-stock alert triggers below this qty</p>
                </div>
                <div className="space-y-1">
                  <Label>Reorder Qty</Label>
                  <Input {...register('reorderQty', { valueAsNumber: true })} type="number" step="1" min="0" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Warehouse <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Select value={formWarehouseId} onValueChange={(v) => { setFormWarehouseId(v); if (!v) setFormQuantity(0) }}>
                    <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No warehouse</SelectItem>
                      {(warehouses ?? []).filter((w) => w.isActive).map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {editing ? 'Use Transfers to move stock between warehouses.' : 'Assigns this item to a warehouse. Use Transfers to move stock later.'}
                  </p>
                </div>
                {!editing && (
                  <div className="col-span-2 space-y-1">
                    <Label>Opening Quantity</Label>
                    <Input
                      type="number" step="0.001" min="0"
                      value={formQuantity}
                      disabled={!formWarehouseId}
                      onChange={(e) => setFormQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-48"
                    />
                    <p className="text-xs text-muted-foreground">Initial stock on hand in the selected warehouse.</p>
                  </div>
                )}
                <div className="col-span-2 space-y-1">
                  <Label>
                    Expiry Date <span className="text-muted-foreground font-normal">(optional — FEFO)</span>
                  </Label>
                  <Input {...register('expiryDate')} type="date" className="w-48" />
                  <p className="text-xs text-muted-foreground">Earliest-expiry-first sorting. Highlighted amber within 30 days, red when expired.</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ExcelImport
        open={showImport}
        onClose={() => setShowImport(false)}
        templateName="Inventory Items"
        templateHeaders={['SKU', 'Barcode', 'Item Name', 'Packing', 'Description', 'UOM', 'Category', 'Standard Cost', 'Selling Price', 'Reorder Point', 'Reorder Qty']}
        sampleRows={[{ 'SKU': 'ITM001', 'Barcode': '5012345678900', 'Item Name': 'Widget A', 'Packing': '2kg', 'Description': 'Standard widget', 'UOM': 'Nos', 'Category': 'Electronics', 'Standard Cost': '10.00', 'Selling Price': '15.00', 'Reorder Point': '50', 'Reorder Qty': '100' }]}
        onImport={async (rows) => {
          const res = await api.post<ImportResult>('/api/inventory/items/import', { rows })
          return res.data ?? { success: 0, failed: rows.length, errors: ['Unknown error'] }
        }}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['items'] })}
      />

      {/* Print Barcode Label Dialog */}
      <Dialog open={!!printItem} onOpenChange={(o) => { if (!o) setPrintItem(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Print Barcode Label</DialogTitle></DialogHeader>
          {printItem?.barcode && (
            <div className="space-y-4">
              <div className="flex justify-center border rounded-md p-4 bg-white">
                <div className="text-center">
                  <p className="text-sm font-medium">{printItem.name}</p>
                  <p className="text-xs text-muted-foreground font-mono mb-1">{printItem.sku}</p>
                  <BarcodeSvg value={printItem.barcode} height={44} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Number of labels</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={printQty}
                  onChange={(e) => setPrintQty(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  className="w-28"
                />
                <p className="text-xs text-muted-foreground">Labels wrap onto A4 sheets; thermal printers get one label per page.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintItem(null)}>Cancel</Button>
            <Button onClick={() => printItem && printLabels([printItem], printQty)}>
              <Printer className="mr-2 h-4 w-4" />Print {printQty > 1 ? `${printQty} Labels` : 'Label'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Disable Item"
        description="Are you sure?"
      />

      <Dialog open={showCatDialog} onOpenChange={(o) => { setShowCatDialog(o); if (!o) setNewCatName('') }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Category Name</Label>
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Electronics"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newCatName.trim()) catMutation.mutate(newCatName.trim()) } }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCatDialog(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={!newCatName.trim() || catMutation.isPending}
              onClick={() => catMutation.mutate(newCatName.trim())}
            >
              {catMutation.isPending ? 'Saving...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
