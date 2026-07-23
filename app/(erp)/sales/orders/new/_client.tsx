'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, ArrowLeft, Search, Package, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

type Customer = { id: string; customerCode: string; name: string; isActive?: boolean }

type WarehouseStock = {
  warehouseId: string
  quantity: number
  warehouse: { id: string; name: string }
}

type InventoryItem = {
  id: string
  sku: string
  name: string
  sellingPrice: number
  uom: string
  packing?: string | null
  warehouseStocks: WarehouseStock[]
}

type LineItem = {
  itemId?: string
  description: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  sku?: string
  availableStock?: number
}

const emptyLine = (): LineItem => ({ description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 })
const lineTotal = (li: LineItem) => li.quantity * li.unitPrice * (1 - li.discount / 100) * (1 + li.taxRate / 100)

export function PageClient({ customers }: { customers: Customer[] }) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [customerId, setCustomerId] = useState('')
  const [orderDate, setOrderDate] = useState(today)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([emptyLine()])
  const [saving, setSaving] = useState(false)

  function updateLine(i: number, field: keyof LineItem, raw: string) {
    setLines((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: field === 'description' ? raw : Number(raw) }
      return next
    })
  }

  function setLineItem(i: number, item: InventoryItem) {
    const totalStock = item.warehouseStocks.reduce((s, ws) => s + Number(ws.quantity), 0)
    setLines((prev) => {
      const next = [...prev]
      next[i] = {
        itemId: item.id,
        description: item.packing ? `${item.name} (${item.packing})` : item.name,
        sku: item.sku,
        quantity: next[i].quantity,
        unitPrice: Number(item.sellingPrice),
        discount: next[i].discount,
        taxRate: next[i].taxRate || 20,
        availableStock: totalStock,
      }
      return next
    })
  }

  const subtotal = lines.reduce((s, li) => s + lineTotal(li), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) return toast.error('Please select a customer')
    if (lines.some((li) => !li.description)) return toast.error('All line items need a description')

    setSaving(true)
    try {
      const res = await api.post<{ id: string; shortfall?: Array<{ description: string; qty: number; available: number }> }>('/api/sales/orders', {
        customerId,
        orderDate,
        deliveryDate: deliveryDate || undefined,
        notes: notes || undefined,
        lineItems: lines.map(({ ...li }) => li),
      })
      if (!res.success) { toast.error(res.error ?? 'Failed to create sales order'); return }

      if (res.data?.shortfall && res.data.shortfall.length > 0) {
        const items = res.data.shortfall.map((s) => `  • ${s.description}: ordered ${s.qty}, available ${s.available}`).join('\n')
        toast.warning(`Order created with stock shortfall:\n${items}`, { duration: 8000 })
      } else {
        toast.success('Sales order created — stock available')
      }
      router.push('/sales/orders')
    } catch {
      toast.error('Failed to create sales order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Sales Order"
        description="Create a sales order with inventory item selection"
        actions={
          <Button variant="outline" asChild>
            <Link href="/sales/orders"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.filter((c) => c.isActive !== false).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Order Date *</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Expected Delivery Date</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div className="col-span-full space-y-1">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes or delivery instructions" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => setLines((p) => [...p, emptyLine()])}>
              <Plus className="mr-1 h-4 w-4" />Add Line
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium min-w-[200px]">Item *</th>
                    <th className="pb-2 pr-2 font-medium w-16">Stock</th>
                    <th className="pb-2 pr-2 font-medium w-20">Qty</th>
                    <th className="pb-2 pr-2 font-medium w-28">Unit Price</th>
                    <th className="pb-2 pr-2 font-medium w-20">Disc %</th>
                    <th className="pb-2 pr-2 font-medium w-20">Tax %</th>
                    <th className="pb-2 pr-2 font-medium w-28 text-right">Total</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((li, i) => (
                    <LineItemRow
                      key={i}
                      line={li}
                      onChange={(field, value) => updateLine(i, field, value)}
                      onSelectItem={(item) => setLineItem(i, item)}
                      onRemove={lines.length > 1 ? () => setLines((p) => p.filter((_, j) => j !== i)) : undefined}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-52 space-y-1 text-sm">
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              </div>
            </div>

            {lines.some((l) => l.itemId && l.availableStock != null && l.quantity > l.availableStock) && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Stock Shortfall Warning
                </div>
                <ul className="mt-1 list-inside list-disc text-amber-700">
                  {lines.filter((l) => l.itemId && l.availableStock != null && l.quantity > l.availableStock).map((l, i) => (
                    <li key={i}>
                      {l.description} (SKU: {l.sku}) — ordered {l.quantity}, only {l.availableStock} in stock
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push('/sales/orders')}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create Order'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function LineItemRow({ line, onChange, onSelectItem, onRemove }: {
  line: LineItem
  onChange: (field: keyof LineItem, value: string) => void
  onSelectItem: (item: InventoryItem) => void
  onRemove?: () => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items-search', debouncedSearch],
    queryFn: () => api.get<InventoryItem[]>('/api/inventory/items', { search: debouncedSearch }).then((r) => r.data ?? []),
    enabled: debouncedSearch.length > 0,
  })

  const isShort = line.itemId && line.availableStock != null && line.quantity > line.availableStock

  return (
    <tr>
      <td className="py-2 pr-2">
        <div ref={ref} className="relative">
          {line.itemId ? (
            <div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-1.5 text-sm">
              <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <span className="font-medium">{line.description}</span>
                <span className="ml-2 text-xs text-muted-foreground">SKU: {line.sku}</span>
              </div>
              <button
                type="button"
                onClick={() => { onChange('description', ''); onChange('itemId', ''); setSearch('') }}
                className="text-xs text-red-500 hover:text-red-700 shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
                  onFocus={() => setOpen(true)}
                  placeholder="Search inventory items..."
                  className="pl-9 h-9 text-sm"
                />
              </div>
              {open && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-md border bg-white shadow-lg">
                  {debouncedSearch.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">Type to search items</div>
                  ) : items.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">No items found</div>
                  ) : (
                    items.map((item) => {
                      const totalStock = item.warehouseStocks.reduce((s, ws) => s + Number(ws.quantity), 0)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 border-b last:border-0"
                          onClick={() => { onSelectItem(item); setOpen(false); setSearch('') }}
                        >
                          <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              SKU: {item.sku} &middot; {item.uom}
                              {item.packing && ` · ${item.packing}`}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-medium">{formatCurrency(Number(item.sellingPrice))}</div>
                            <Badge variant={totalStock > 0 ? 'outline' : 'secondary'} className={totalStock > 0 ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-red-500 border-red-200 bg-red-50'}>
                              {totalStock} in stock
                            </Badge>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </td>
      <td className="py-2 pr-2">
        {line.itemId ? (
          <Badge variant="outline" className={isShort ? 'text-red-600 border-red-200 bg-red-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}>
            {isShort && <AlertTriangle className="mr-1 h-3 w-3" />}
            {line.availableStock ?? '-'}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>
      <td className="py-2 pr-2">
        <Input type="number" min="0.001" step="any" value={line.quantity} onChange={(e) => onChange('quantity', e.target.value)} />
      </td>
      <td className="py-2 pr-2">
        <Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => onChange('unitPrice', e.target.value)} />
      </td>
      <td className="py-2 pr-2">
        <Input type="number" min="0" max="100" step="0.1" value={line.discount} onChange={(e) => onChange('discount', e.target.value)} />
      </td>
      <td className="py-2 pr-2">
        <Input type="number" min="0" max="100" step="0.1" value={line.taxRate} onChange={(e) => onChange('taxRate', e.target.value)} />
      </td>
      <td className="py-2 pr-2 text-right font-medium">{formatCurrency(lineTotal(line))}</td>
      <td className="py-2">
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  )
}
