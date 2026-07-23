'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Eye, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type PriceList = { id: string; code: string; name: string; currency: string; isDefault: boolean; isActive: boolean; startDate: string | null; endDate: string | null; _count: { items: number } }
const empty = { name: '', currency: 'GBP', startDate: '', endDate: '', description: '', isDefault: false }

export function PageClient({ initialData }: { initialData: PriceList[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(empty)

  const { data, isLoading, error } = useQuery({
    queryKey: ['price-lists'],
    queryFn: () => api.get<PriceList[]>('/api/sales/price-lists').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/sales/price-lists', { ...form, isDefault: form.isDefault }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['price-lists'] })
      const previous = qc.getQueryData(['price-lists'])
      qc.setQueryData(['price-lists'], (old: any[]) => [{ ...form, id: 'temp-' + Date.now(), code: '', _count: { items: 0 }, isActive: true }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Price list created') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['price-lists'], context.previous); toast.error('Failed to save') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['price-lists'] }); setShowForm(false); setForm(empty) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/sales/price-lists/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['price-lists'] })
      const previous = qc.getQueryData(['price-lists'])
      qc.setQueryData(['price-lists'], (old: any[]) => old.filter((item) => item.id !== id))
      return { previous }
    },
    onSuccess: () => { toast.success('Deleted') },
    onError: (err, id, context) => { if (context?.previous) qc.setQueryData(['price-lists'], context.previous); toast.error('Failed to delete') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['price-lists'] }); setDeleteId(null) },
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Price Lists" description="Manage customer price lists" actions={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />New Price List</Button>} />
      <DataTable
        columns={[
          { key: 'code', header: 'Code', sortable: true },
          { key: 'name', header: 'Name', sortable: true },
          { key: 'currency', header: 'Currency' },
          { key: 'items', header: 'Items', render: (r: PriceList) => r._count.items },
          { key: 'startDate', header: 'Valid From', render: (r: PriceList) => r.startDate ? formatDate(r.startDate) : '—' },
          { key: 'endDate', header: 'Valid To', render: (r: PriceList) => r.endDate ? formatDate(r.endDate) : '—' },
          { key: 'isDefault', header: '', render: (r: PriceList) => r.isDefault ? <Badge variant="success">Default</Badge> : null },
          { key: 'isActive', header: 'Status', render: (r: PriceList) => <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
        ]}
        data={data} isLoading={isLoading} error={error}
        actions={(row) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" asChild><Link href={`/sales/price-lists/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Price List</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Valid From</Label><Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Valid To</Label><Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name}>{createMutation.isPending ? 'Saving…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Price List" description="This price list will be removed." />
    </div>
  )
}
