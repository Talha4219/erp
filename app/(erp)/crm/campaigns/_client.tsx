'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type Campaign = { id: string; name: string; type: string; status: string; startDate: string | null; endDate: string | null; budget: number | null; _count: { leads: number } }

const STATUSES = ['DRAFT','ACTIVE','PAUSED','COMPLETED','CANCELLED']
const TYPES = ['EMAIL','SOCIAL_MEDIA','COLD_CALL','EVENT','WEBINAR','ADVERTISEMENT','OTHER']
const STATUS_VARIANT: Record<string, 'success'|'info'|'warning'|'destructive'|'secondary'> = { ACTIVE: 'success', DRAFT: 'secondary', PAUSED: 'warning', COMPLETED: 'info', CANCELLED: 'destructive' }

export function PageClient({ initialData }: { initialData: Campaign[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', type: 'EMAIL', status: 'DRAFT', startDate: '', endDate: '', budget: '', description: '', targetAudience: '' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['crm-campaigns'],
    queryFn: () => api.get<Campaign[]>('/api/crm/campaigns').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/crm/campaigns', { ...form, budget: form.budget ? Number(form.budget) : undefined, startDate: form.startDate || undefined, endDate: form.endDate || undefined }),
    onMutate: async () => { await qc.cancelQueries({ queryKey: ['crm-campaigns'] }); const previous = qc.getQueryData(['crm-campaigns']); qc.setQueryData(['crm-campaigns'], (old: any[]) => [{ ...form, id: 'temp-' + Date.now(), budget: form.budget ? Number(form.budget) : null, _count: { leads: 0 } }, ...(old ?? [])]); return { previous } },
    onSuccess: () => { toast.success('Campaign created') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['crm-campaigns'], context.previous); toast.error('Failed to save') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['crm-campaigns'] }); setShowForm(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/crm/campaigns/${id}`),
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: ['crm-campaigns'] }); const previous = qc.getQueryData(['crm-campaigns']); qc.setQueryData(['crm-campaigns'], (old: any[]) => old.filter((item) => item.id !== id)); return { previous } },
    onSuccess: () => { toast.success('Campaign deleted') },
    onError: (err, id, context) => { if (context?.previous) qc.setQueryData(['crm-campaigns'], context.previous); toast.error('Failed to delete') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['crm-campaigns'] }); setDeleteId(null) },
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Campaigns" description="Manage marketing campaigns" actions={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />New Campaign</Button>} />
      <DataTable
        columns={[
          { key: 'name', header: 'Campaign', sortable: true },
          { key: 'type', header: 'Type', render: (r: Campaign) => r.type.replace(/_/g,' ') },
          { key: 'status', header: 'Status', render: (r: Campaign) => <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status}</Badge> },
          { key: 'leads', header: 'Leads', render: (r: Campaign) => r._count.leads },
          { key: 'budget', header: 'Budget', render: (r: Campaign) => r.budget ? formatCurrency(Number(r.budget)) : '—' },
          { key: 'startDate', header: 'Start', render: (r: Campaign) => r.startDate ? formatDate(r.startDate) : '—' },
          { key: 'endDate', header: 'End', render: (r: Campaign) => r.endDate ? formatDate(r.endDate) : '—' },
        ]}
        data={data ?? []} isLoading={isLoading} error={error}
        actions={(row) => <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Type</Label><Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g,' ')}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>End Date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Budget (£)</Label><Input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Target Audience</Label><Input value={form.targetAudience} onChange={(e) => setForm((p) => ({ ...p, targetAudience: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name}>{createMutation.isPending ? 'Saving…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Campaign" description="This campaign will be removed." />
    </div>
  )
}
