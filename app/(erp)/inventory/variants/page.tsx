'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, ChevronDown, ChevronRight, Tag, Package2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'

type AttributeValue = { id: string; value: string; sortOrder: number }
type Attribute = { id: string; name: string; values: AttributeValue[] }
type VariantAttribute = {
  id: string
  attributeValue: { id: string; value: string; attribute: { id: string; name: string } }
}
type Variant = {
  id: string; sku: string; barcode: string | null; name: string | null
  sellingPrice: string | null; standardCost: string | null; isActive: boolean
  createdAt: string; attributes: VariantAttribute[]
}
type Item = { id: string; itemCode: string; name: string; category: { name: string } | null }

export default function VariantsPage() {
  const qc = useQueryClient()

  // Attribute state
  const [attrOpen, setAttrOpen] = useState(false)
  const [attrName, setAttrName] = useState('')
  const [expandedAttr, setExpandedAttr] = useState<string | null>(null)
  const [newValueInputs, setNewValueInputs] = useState<Record<string, string>>({})

  // Variant state
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [variantOpen, setVariantOpen] = useState(false)
  const [variantForm, setVariantForm] = useState({
    sku: '', barcode: '', name: '', sellingPrice: '', standardCost: '',
    attributeValueIds: [] as string[],
  })

  const { data: attributes = [], isLoading: attrsLoading } = useQuery<Attribute[]>({
    queryKey: ['item-attributes'],
    queryFn: () => api.get<Attribute[]>('/api/inventory/attributes').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items-list'],
    queryFn: () => api.get<Item[]>('/api/inventory/items').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const { data: variants = [], isLoading: variantsLoading } = useQuery<Variant[]>({
    queryKey: ['item-variants', selectedItemId],
    queryFn: () => selectedItemId
      ? api.get<Variant[]>(`/api/inventory/items/${selectedItemId}/variants`).then((r) => r.data ?? [])
      : Promise.resolve([]),
    enabled: !!selectedItemId,
    placeholderData: (previousData) => previousData,
  })

  const createAttr = useMutation({
    mutationFn: (name: string) => api.post('/api/inventory/attributes', { name }),
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: ['item-attributes'] })
      const previous = qc.getQueryData(['item-attributes'])
      qc.setQueryData(['item-attributes'], (old: any[]) => [{ id: 'temp-' + Date.now(), name, values: [] }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Attribute created') },
    onError: (err, name, context) => { if (context?.previous) qc.setQueryData(['item-attributes'], context.previous); toast.error('Failed to create attribute') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['item-attributes'] }); setAttrOpen(false); setAttrName('') },
  })

  const deleteAttr = useMutation({
    mutationFn: (id: string) => api.delete(`/api/inventory/attributes/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['item-attributes'] })
      const previous = qc.getQueryData(['item-attributes'])
      qc.setQueryData(['item-attributes'], (old: any[]) => old.filter((item: any) => item.id !== id))
      return { previous }
    },
    onSuccess: () => { toast.success('Attribute deleted') },
    onError: (err, id, context) => { if (context?.previous) qc.setQueryData(['item-attributes'], context.previous); toast.error('Failed to delete attribute') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['item-attributes'] }) },
  })

  const addValue = useMutation({
    mutationFn: ({ attrId, value }: { attrId: string; value: string }) =>
      api.patch(`/api/inventory/attributes/${attrId}`, { action: 'add_value', value }),
    onMutate: async ({ attrId, value }) => {
      await qc.cancelQueries({ queryKey: ['item-attributes'] })
      const previous = qc.getQueryData(['item-attributes'])
      qc.setQueryData(['item-attributes'], (old: any[]) => old.map((attr: any) => attr.id === attrId ? { ...attr, values: [...attr.values, { id: 'temp-' + Date.now(), value, sortOrder: attr.values.length }] } : attr))
      return { previous }
    },
    onSuccess: () => { toast.success('Value added') },
    onError: (err, vars, context) => { if (context?.previous) qc.setQueryData(['item-attributes'], context.previous); toast.error('Failed to add value') },
    onSettled: (data, err, vars) => { qc.invalidateQueries({ queryKey: ['item-attributes'] }); setNewValueInputs((p) => ({ ...p, [vars.attrId]: '' })) },
  })

  const deleteValue = useMutation({
    mutationFn: ({ attrId, valueId }: { attrId: string; valueId: string }) =>
      api.patch(`/api/inventory/attributes/${attrId}`, { action: 'delete_value', valueId }),
    onMutate: async ({ attrId, valueId }) => {
      await qc.cancelQueries({ queryKey: ['item-attributes'] })
      const previous = qc.getQueryData(['item-attributes'])
      qc.setQueryData(['item-attributes'], (old: any[]) => old.map((attr: any) => attr.id === attrId ? { ...attr, values: attr.values.filter((v: any) => v.id !== valueId) } : attr))
      return { previous }
    },
    onSuccess: () => { toast.success('Value deleted') },
    onError: (err, vars, context) => { if (context?.previous) qc.setQueryData(['item-attributes'], context.previous); toast.error('Failed to delete value') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['item-attributes'] }) },
  })

  const createVariant = useMutation({
    mutationFn: (data: typeof variantForm) =>
      api.post(`/api/inventory/items/${selectedItemId}/variants`, {
        ...data,
        sellingPrice: data.sellingPrice ? parseFloat(data.sellingPrice) : null,
        standardCost: data.standardCost ? parseFloat(data.standardCost) : null,
        barcode: data.barcode || null,
        name: data.name || null,
      }),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['item-variants', selectedItemId] })
      const previous = qc.getQueryData(['item-variants', selectedItemId])
      qc.setQueryData(['item-variants', selectedItemId], (old: any[]) => [{ ...newData, id: 'temp-' + Date.now(), sellingPrice: newData.sellingPrice || null, standardCost: newData.standardCost || null, barcode: newData.barcode || null, name: newData.name || null, isActive: true, createdAt: new Date().toISOString(), attributes: [] }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Variant created') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['item-variants', selectedItemId], context.previous); toast.error('Failed to create variant') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['item-variants', selectedItemId] }); setVariantOpen(false); setVariantForm({ sku: '', barcode: '', name: '', sellingPrice: '', standardCost: '', attributeValueIds: [] }) },
  })

  const toggleVariant = useMutation({
    mutationFn: ({ variantId, isActive }: { variantId: string; isActive: boolean }) =>
      api.patch(`/api/inventory/items/${selectedItemId}/variants/${variantId}`, { isActive }),
    onMutate: async ({ variantId, isActive }) => {
      await qc.cancelQueries({ queryKey: ['item-variants', selectedItemId] })
      const previous = qc.getQueryData(['item-variants', selectedItemId])
      qc.setQueryData(['item-variants', selectedItemId], (old: any[]) => old.map((v: any) => v.id === variantId ? { ...v, isActive } : v))
      return { previous }
    },
    onError: (err, vars, context) => { if (context?.previous) qc.setQueryData(['item-variants', selectedItemId], context.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['item-variants', selectedItemId] }),
  })

  const deleteVariant = useMutation({
    mutationFn: (variantId: string) =>
      api.delete(`/api/inventory/items/${selectedItemId}/variants/${variantId}`),
    onMutate: async (variantId) => {
      await qc.cancelQueries({ queryKey: ['item-variants', selectedItemId] })
      const previous = qc.getQueryData(['item-variants', selectedItemId])
      qc.setQueryData(['item-variants', selectedItemId], (old: any[]) => old.filter((v: any) => v.id !== variantId))
      return { previous }
    },
    onSuccess: () => { toast.success('Variant deleted') },
    onError: (err, variantId, context) => { if (context?.previous) qc.setQueryData(['item-variants', selectedItemId], context.previous); toast.error('Failed to delete variant') },
    onSettled: () => qc.invalidateQueries({ queryKey: ['item-variants', selectedItemId] }),
  })

  const selectedItem = items.find((i) => i.id === selectedItemId)

  const toggleAttrValueId = (id: string) => {
    setVariantForm((f) => ({
      ...f,
      attributeValueIds: f.attributeValueIds.includes(id)
        ? f.attributeValueIds.filter((x) => x !== id)
        : [...f.attributeValueIds, id],
    }))
  }

  return (
    <>
      <PageHeader
        title="Item Variants"
        description="Manage product attributes and variant combinations"
      />

      <Tabs defaultValue="attributes">
        <TabsList className="mb-6">
          <TabsTrigger value="attributes">Attributes</TabsTrigger>
          <TabsTrigger value="variants">Item Variants</TabsTrigger>
        </TabsList>

        {/* ── ATTRIBUTES TAB ──────────────────────────────────── */}
        <TabsContent value="attributes">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Define attributes like Color, Size, Material. Then add values (Red, Blue, Large…).
            </p>
            <Button size="sm" onClick={() => setAttrOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />New Attribute
            </Button>
          </div>

          {attrsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}</div>
          ) : attributes.length === 0 ? (
            <div className="rounded-lg border border-dashed p-16 text-center text-muted-foreground">
              <Tag className="mx-auto h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">No attributes yet</p>
              <p className="text-sm mt-1">Create attributes like Color or Size to define variant combinations</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attributes.map((attr) => (
                <Card key={attr.id} className="overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      className="flex items-center gap-2 text-sm font-medium hover:text-primary"
                      onClick={() => setExpandedAttr(expandedAttr === attr.id ? null : attr.id)}
                    >
                      {expandedAttr === attr.id
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      {attr.name}
                      <Badge variant="secondary" className="text-xs">{attr.values.length} values</Badge>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400 hover:text-red-600"
                      onClick={() => { if (confirm(`Delete attribute "${attr.name}" and all its values?`)) deleteAttr.mutate(attr.id) }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {expandedAttr === attr.id && (
                    <div className="border-t bg-muted/20 px-4 py-3">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {attr.values.map((v) => (
                          <div key={v.id} className="flex items-center gap-1 rounded-full border bg-white px-2.5 py-0.5 text-xs">
                            <span>{v.value}</span>
                            <button
                              className="text-muted-foreground hover:text-red-500"
                              onClick={() => deleteValue.mutate({ attrId: attr.id, valueId: v.id })}
                            >×</button>
                          </div>
                        ))}
                        {attr.values.length === 0 && (
                          <span className="text-xs text-muted-foreground">No values yet</span>
                        )}
                      </div>
                      <div className="flex gap-2 max-w-xs">
                        <Input
                          placeholder="Add value…"
                          className="h-7 text-xs"
                          value={newValueInputs[attr.id] ?? ''}
                          onChange={(e) => setNewValueInputs((p) => ({ ...p, [attr.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newValueInputs[attr.id]?.trim()) {
                              addValue.mutate({ attrId: attr.id, value: newValueInputs[attr.id].trim() })
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={!newValueInputs[attr.id]?.trim() || addValue.isPending}
                          onClick={() => {
                            if (newValueInputs[attr.id]?.trim()) {
                              addValue.mutate({ attrId: attr.id, value: newValueInputs[attr.id].trim() })
                            }
                          }}
                        >Add</Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── ITEM VARIANTS TAB ───────────────────────────────── */}
        <TabsContent value="variants">
          <div className="flex items-center gap-4 mb-6">
            <select
              className="rounded-md border px-3 py-2 text-sm w-72"
              value={selectedItemId ?? ''}
              onChange={(e) => setSelectedItemId(e.target.value || null)}
            >
              <option value="">Select an item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.itemCode}] {item.name}
                </option>
              ))}
            </select>
            {selectedItemId && (
              <Button size="sm" onClick={() => setVariantOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Add Variant
              </Button>
            )}
          </div>

          {!selectedItemId ? (
            <div className="rounded-lg border border-dashed p-16 text-center text-muted-foreground">
              <Package2 className="mx-auto h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">Select an item to manage its variants</p>
            </div>
          ) : variantsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}</div>
          ) : variants.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              <p className="font-medium">No variants for {selectedItem?.name}</p>
              <p className="text-sm mt-1">Add variants to differentiate by size, colour, or other attributes</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Attributes</th>
                    <th className="px-3 py-2 text-right">Sell Price</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {variants.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-xs font-medium">{v.sku}</td>
                      <td className="px-3 py-2 text-muted-foreground">{v.name ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {v.attributes.map((a) => (
                            <Badge key={a.id} variant="secondary" className="text-xs">
                              {a.attributeValue.attribute.name}: {a.attributeValue.value}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {v.sellingPrice ? formatCurrency(parseFloat(v.sellingPrice)) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {v.standardCost ? formatCurrency(parseFloat(v.standardCost)) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => toggleVariant.mutate({ variantId: v.id, isActive: !v.isActive })}>
                          <Badge className={v.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}>
                            {v.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-400 hover:text-red-600"
                          onClick={() => { if (confirm('Delete this variant?')) deleteVariant.mutate(v.id) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create Attribute dialog ── */}
      <Dialog open={attrOpen} onOpenChange={setAttrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Attribute</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Attribute Name *</label>
              <Input
                placeholder="e.g. Color, Size, Material"
                value={attrName}
                onChange={(e) => setAttrName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && attrName.trim()) createAttr.mutate(attrName.trim()) }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttrOpen(false)}>Cancel</Button>
            <Button
              disabled={!attrName.trim() || createAttr.isPending}
              onClick={() => createAttr.mutate(attrName.trim())}
            >Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Variant dialog ── */}
      <Dialog open={variantOpen} onOpenChange={setVariantOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Variant — {selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">SKU *</label>
                <Input
                  placeholder="e.g. SHIRT-RED-L"
                  value={variantForm.sku}
                  onChange={(e) => setVariantForm((f) => ({ ...f, sku: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Barcode</label>
                <Input
                  placeholder="optional"
                  value={variantForm.barcode}
                  onChange={(e) => setVariantForm((f) => ({ ...f, barcode: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Display Name</label>
                <Input
                  placeholder="optional"
                  value={variantForm.name}
                  onChange={(e) => setVariantForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="col-span-1" />
              <div className="space-y-1">
                <label className="text-xs font-medium">Selling Price</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={variantForm.sellingPrice}
                  onChange={(e) => setVariantForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Standard Cost</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={variantForm.standardCost}
                  onChange={(e) => setVariantForm((f) => ({ ...f, standardCost: e.target.value }))}
                />
              </div>
            </div>

            {attributes.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium">Attribute Values *</label>
                <div className="space-y-2 rounded-md border p-3">
                  {attributes.map((attr) => (
                    <div key={attr.id}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">{attr.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {attr.values.map((v) => (
                          <label key={v.id} className="flex items-center gap-1 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={variantForm.attributeValueIds.includes(v.id)}
                              onChange={() => toggleAttrValueId(v.id)}
                            />
                            {v.value}
                          </label>
                        ))}
                        {attr.values.length === 0 && (
                          <span className="text-xs text-muted-foreground">No values — add values in Attributes tab</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantOpen(false)}>Cancel</Button>
            <Button
              disabled={!variantForm.sku || variantForm.attributeValueIds.length === 0 || createVariant.isPending}
              onClick={() => createVariant.mutate(variantForm)}
            >Add Variant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
