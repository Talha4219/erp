'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

type Contact = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; mobile: string | null; jobTitle: string | null; department: string | null; customer: { name: string } | null }
type Customer = { id: string; name: string }

export function PageClient({ initialData }: { initialData: Contact[] }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', mobile: '', jobTitle: '', department: '', customerId: '', notes: '' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['crm-contacts'],
    queryFn: () => api.get<Contact[]>('/api/crm/contacts').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/api/sales/customers').then((r) => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((c) => !search || `${c.firstName} ${c.lastName} ${c.email ?? ''} ${c.customer?.name ?? ''}`.toLowerCase().includes(search.toLowerCase()))

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/crm/contacts', { ...form, customerId: form.customerId || undefined }),
    onMutate: async () => { await qc.cancelQueries({ queryKey: ['crm-contacts'] }); const previous = qc.getQueryData<Contact[]>(['crm-contacts']); const customer = customers.find((c) => c.id === form.customerId); const temp: Contact = { id: `temp-${Date.now()}`, firstName: form.firstName, lastName: form.lastName, email: form.email || null, phone: form.phone || null, mobile: form.mobile || null, jobTitle: form.jobTitle || null, department: form.department || null, customer: customer ?? null }; qc.setQueryData<Contact[]>(['crm-contacts'], (old) => [temp, ...(old ?? [])]); return { previous } },
    onSuccess: () => { toast.success('Contact created'); setShowForm(false) },
    onError: (_err, _vars, context) => { if (context?.previous) qc.setQueryData(['crm-contacts'], context.previous); toast.error('Failed to save') },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm-contacts'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/crm/contacts/${id}`),
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: ['crm-contacts'] }); const previous = qc.getQueryData<Contact[]>(['crm-contacts']); qc.setQueryData<Contact[]>(['crm-contacts'], (old) => old?.filter((c) => c.id !== id) ?? []); return { previous } },
    onSuccess: () => { setDeleteId(null) },
    onError: (_err, _vars, context) => { if (context?.previous) qc.setQueryData(['crm-contacts'], context.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm-contacts'] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Contacts" description="Manage your CRM contacts" actions={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Add Contact</Button>} />
      <div className="flex gap-3">
        <Input placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        {search && <Button variant="outline" size="sm" onClick={() => setSearch('')}><X className="h-4 w-4 mr-1" />Clear</Button>}
      </div>
      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (r: Contact) => `${r.firstName} ${r.lastName}` },
          { key: 'jobTitle', header: 'Job Title', render: (r: Contact) => r.jobTitle ?? '—' },
          { key: 'email', header: 'Email', render: (r: Contact) => r.email ?? '—' },
          { key: 'phone', header: 'Phone', render: (r: Contact) => r.phone ?? r.mobile ?? '—' },
          { key: 'customer', header: 'Company', render: (r: Contact) => r.customer?.name ?? '—' },
        ]}
        data={filtered} isLoading={isLoading} error={error}
        actions={(row) => <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {(['firstName','lastName','email','phone','mobile','jobTitle','department'] as const).map((f) => (
              <div key={f} className="space-y-1"><Label className="capitalize">{f.replace(/([A-Z])/g, ' $1')}</Label><Input value={(form as Record<string, string>)[f]} onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))} /></div>
            ))}
            <div className="space-y-1"><Label>Linked Company</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm((p) => ({ ...p, customerId: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent><SelectItem value="">None</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving…' : 'Add Contact'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Contact" description="This contact will be removed." />
    </div>
  )
}
