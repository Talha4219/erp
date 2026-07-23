'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

type Partner = { id: string; code: string; name: string; type: 'CUSTOMER' | 'VENDOR'; email: string | null; phone: string | null; city: string | null; country: string | null; creditLimit: string | null; isActive: boolean; createdAt: string; transactionCount: number }

export function PageClient({ initialData }: { initialData: Partner[] }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', name: '', type: 'CUSTOMER' as 'CUSTOMER' | 'VENDOR', email: '', phone: '', city: '', country: '', creditLimit: '' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['business-partners'],
    queryFn: () => api.get<Partner[]>('/api/business-partners').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((p) => {
    if (filterType && p.type !== filterType) return false
    if (search) { const q = search.toLowerCase(); return `${p.name} ${p.code} ${p.email ?? ''} ${p.city ?? ''}`.toLowerCase().includes(q) }
    return true
  })

  const saveMut = useMutation({
    mutationFn: () => api.post('/api/business-partners', { ...form, creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined }),
    onMutate: async () => { await qc.cancelQueries({ queryKey: ['business-partners'] }); const previous = qc.getQueryData(['business-partners']); qc.setQueryData(['business-partners'], (old: any[]) => [{ ...form, id: 'temp-' + Date.now(), creditLimit: form.creditLimit || null, isActive: true, createdAt: new Date().toISOString(), transactionCount: 0 }, ...(old ?? [])]); return { previous } },
    onSuccess: () => { toast.success(editing ? 'Partner updated' : 'Partner created') },
    onError: (err, _vars, context) => { if (context?.previous) qc.setQueryData(['business-partners'], context.previous); toast.error('Failed to save') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['business-partners'] }); setShowForm(false); setEditing(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/business-partners/${id}`),
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: ['business-partners'] }); const previous = qc.getQueryData(['business-partners']); qc.setQueryData(['business-partners'], (old: any[]) => old.filter((p) => p.id !== id)); return { previous } },
    onSuccess: () => { setDeleteId(null); toast.success('Partner removed') },
    onError: (err, _vars, context) => { if (context?.previous) qc.setQueryData(['business-partners'], context.previous); toast.error('Failed to delete') },
    onSettled: () => qc.invalidateQueries({ queryKey: ['business-partners'] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Business Partners" description="Customers and vendors combined view" actions={<Button onClick={() => { setEditing(null); setForm({ code: '', name: '', type: 'CUSTOMER', email: '', phone: '', city: '', country: '', creditLimit: '' }); setShowForm(true) }}><Plus className="mr-2 h-4 w-4" />Add Partner</Button>} />
      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Search partners…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent><SelectItem value="">All</SelectItem><SelectItem value="CUSTOMER">Customer</SelectItem><SelectItem value="VENDOR">Vendor</SelectItem></SelectContent>
        </Select>
        {(search || filterType) && <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterType('') }}><X className="h-4 w-4 mr-1" />Clear</Button>}
      </div>
      <DataTable
        columns={[
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Name', sortable: true },
          { key: 'type', header: 'Type', render: (r: Partner) => <Badge variant={r.type === 'CUSTOMER' ? 'info' : 'warning'}>{r.type}</Badge> },
          { key: 'email', header: 'Email', render: (r: Partner) => r.email ?? '—' },
          { key: 'phone', header: 'Phone', render: (r: Partner) => r.phone ?? '—' },
          { key: 'city', header: 'City', render: (r: Partner) => r.city ?? '—' },
          { key: 'creditLimit', header: 'Credit Limit', render: (r: Partner) => r.creditLimit ? `£${Number(r.creditLimit).toFixed(2)}` : '—' },
          { key: 'isActive', header: 'Status', render: (r: Partner) => <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
        ]}
        data={filtered} isLoading={isLoading} error={error}
        actions={(row) => <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>}
      />
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Partner' : 'Add Partner'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {(['code', 'name', 'email', 'phone', 'city', 'country', 'creditLimit'] as const).map((f) => (
              <div key={f} className="space-y-1"><Label className="capitalize">{f.replace(/([A-Z])/g, ' $1')}</Label><Input value={form[f] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))} /></div>
            ))}
            <div className="space-y-1"><Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as 'CUSTOMER' | 'VENDOR' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="CUSTOMER">Customer</SelectItem><SelectItem value="VENDOR">Vendor</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null) }}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMut.mutate(deleteId)} loading={deleteMut.isPending} title="Remove Partner" description="This partner will be removed." />
    </div>
  )
}
