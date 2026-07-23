'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Layers } from 'lucide-react'
import { toast } from 'sonner'

type UoM = { id: string; code: string; name: string; symbol: string; category: string; isBase: boolean; isActive: boolean; createdAt: string }

const CATEGORIES = ['Weight', 'Volume', 'Length', 'Area', 'Count', 'Time', 'Temperature', 'Other']

export function PageClient({ initialData }: { initialData: UoM[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', symbol: '', category: '', isBase: false })

  const { data: uoms = [], isLoading, error } = useQuery({
    queryKey: ['uoms'],
    queryFn: () => api.get<UoM[]>('/api/inventory/uom').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })

  const create = useMutation({
    mutationFn: (d: typeof form) => api.post('/api/inventory/uom', d),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['uoms'] })
      const previous = qc.getQueryData(['uoms'])
      qc.setQueryData(['uoms'], (old: any[]) => [{ ...newData, id: 'temp-' + Date.now(), createdAt: new Date().toISOString() }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Unit of measure created') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['uoms'], context.previous); toast.error('Failed to create UoM') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['uoms'] }); setOpen(false); setForm({ code: '', name: '', symbol: '', category: '', isBase: false }) },
  })

  const grouped = CATEGORIES.reduce<Record<string, UoM[]>>((acc, cat) => {
    acc[cat] = uoms.filter((u) => u.category === cat)
    return acc
  }, {})

  const columns = [
    { key: 'code', header: 'Code', render: (r: UoM) => <span className="font-mono font-medium">{r.code}</span> },
    { key: 'name', header: 'Name' },
    { key: 'symbol', header: 'Symbol', render: (r: UoM) => <span className="font-mono">{r.symbol}</span> },
    { key: 'category', header: 'Category', render: (r: UoM) => <Badge variant="secondary">{r.category}</Badge> },
    { key: 'isBase', header: 'Base Unit', render: (r: UoM) => r.isBase ? <Badge className="bg-green-100 text-green-800">Base</Badge> : null },
  ]

  const unusedCategories = CATEGORIES.filter((c) => (grouped[c]?.length ?? 0) === 0)

  return (
    <>
      <PageHeader
        title="Units of Measure"
        description="Define measurement units for inventory items"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />New Unit
          </Button>
        }
      />

      {uoms.length === 0 && !isLoading ? (
        <div className="rounded-lg border border-dashed p-16 text-center text-muted-foreground">
          <Layers className="mx-auto h-12 w-12 mb-4 opacity-30" />
          <p className="font-medium">No units of measure configured</p>
          <p className="text-sm mt-1">Add units like kg, L, m, EA to get started</p>
        </div>
      ) : (
        <DataTable columns={columns} data={uoms} isLoading={isLoading} error={error} />
      )}

      {unusedCategories.length < CATEGORIES.length && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORIES.filter((c) => (grouped[c]?.length ?? 0) > 0).map((cat) => (
            <div key={cat} className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">{cat}</p>
              <div className="flex flex-wrap gap-1">
                {grouped[cat].map((u) => (
                  <Badge key={u.id} variant="outline" className="font-mono text-xs">{u.symbol}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Unit of Measure</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Code *</label>
                <Input placeholder="kg" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Symbol *</label>
                <Input placeholder="kg" value={form.symbol} onChange={(e) => setForm(f => ({ ...f, symbol: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Name *</label>
              <Input placeholder="Kilogram" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Category *</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.category}
                onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isBase} onChange={(e) => setForm(f => ({ ...f, isBase: e.target.checked }))} />
              Base unit for this category
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.code || !form.name || !form.symbol || !form.category || create.isPending}
              onClick={() => create.mutate(form)}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
