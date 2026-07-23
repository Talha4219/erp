'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Plus, Eye, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type Lead = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; company: string | null; jobTitle: string | null; source: string; status: string; rating: number }

const STATUS_VARIANT: Record<string, 'success'|'info'|'warning'|'destructive'|'secondary'> = { NEW: 'info', CONTACTED: 'warning', QUALIFIED: 'success', UNQUALIFIED: 'secondary', CONVERTED: 'success' }
const SOURCES = ['WEBSITE','REFERRAL','COLD_CALL','EMAIL','SOCIAL_MEDIA','ADVERTISEMENT','OTHER']
const STATUSES = ['NEW','CONTACTED','QUALIFIED','UNQUALIFIED','CONVERTED']

export function PageClient({ initialData }: { initialData: Lead[] }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', jobTitle: '', source: 'OTHER', status: 'NEW', notes: '' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['crm-leads'],
    queryFn: () => api.get<Lead[]>('/api/crm/leads').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((l) => {
    if (filterStatus && l.status !== filterStatus) return false
    if (search) { const q = search.toLowerCase(); return `${l.firstName} ${l.lastName} ${l.company ?? ''} ${l.email ?? ''}`.toLowerCase().includes(q) }
    return true
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/crm/leads', form),
    onMutate: async () => { await qc.cancelQueries({ queryKey: ['crm-leads'] }); const previous = qc.getQueryData<Lead[]>(['crm-leads']); const temp: Lead = { id: `temp-${Date.now()}`, firstName: form.firstName, lastName: form.lastName, email: form.email || null, phone: form.phone || null, company: form.company || null, jobTitle: form.jobTitle || null, source: form.source, status: form.status, rating: 0 }; qc.setQueryData<Lead[]>(['crm-leads'], (old) => [temp, ...(old ?? [])]); return { previous } },
    onSuccess: () => { toast.success('Lead added'); setShowForm(false) },
    onError: (_err, _vars, context) => { if (context?.previous) qc.setQueryData(['crm-leads'], context.previous); toast.error('Failed to save') },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm-leads'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/crm/leads/${id}`),
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: ['crm-leads'] }); const previous = qc.getQueryData<Lead[]>(['crm-leads']); qc.setQueryData<Lead[]>(['crm-leads'], (old) => old?.filter((l) => l.id !== id) ?? []); return { previous } },
    onSuccess: () => { setDeleteId(null) },
    onError: (_err, _vars, context) => { if (context?.previous) qc.setQueryData(['crm-leads'], context.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm-leads'] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" description="Manage your sales leads" actions={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Add Lead</Button>} />
      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Search leads…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent><SelectItem value="">All</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        {(search || filterStatus) && <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterStatus('') }}><X className="h-4 w-4 mr-1" />Clear</Button>}
      </div>
      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (r: Lead) => `${r.firstName} ${r.lastName}` },
          { key: 'company', header: 'Company', render: (r: Lead) => r.company ?? '—' },
          { key: 'email', header: 'Email', render: (r: Lead) => r.email ?? '—' },
          { key: 'phone', header: 'Phone', render: (r: Lead) => r.phone ?? '—' },
          { key: 'source', header: 'Source', render: (r: Lead) => r.source.replace(/_/g, ' ') },
          { key: 'status', header: 'Status', render: (r: Lead) => <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status}</Badge> },
        ]}
        data={filtered} isLoading={isLoading} error={error}
        actions={(row) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" asChild><Link href={`/crm/leads/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {(['firstName','lastName','email','phone','company','jobTitle'] as const).map((f) => (
              <div key={f} className="space-y-1"><Label className="capitalize">{f.replace(/([A-Z])/g, ' $1')}</Label><Input value={(form as Record<string, string>)[f]} onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))} /></div>
            ))}
            <div className="space-y-1"><Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm((p) => ({ ...p, source: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="col-span-2 space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving…' : 'Add Lead'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Lead" description="This lead will be removed." />
    </div>
  )
}
