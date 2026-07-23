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
import { Plus, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

type Activity = { id: string; type: string; subject: string; description: string | null; dueDate: string | null; completedAt: string | null; createdAt: string; lead: { firstName: string; lastName: string } | null; contact: { firstName: string; lastName: string } | null; opportunity: { title: string } | null }

const TYPES = ['CALL','MEETING','NOTE','FOLLOW_UP','EMAIL_LOG','TASK']
const TYPE_VARIANT: Record<string, 'info'|'warning'|'secondary'|'success'> = { CALL: 'info', MEETING: 'warning', NOTE: 'secondary', FOLLOW_UP: 'warning', EMAIL_LOG: 'info', TASK: 'secondary' }

export function PageClient({ initialData }: { initialData: Activity[] }) {
  const qc = useQueryClient()
  const [filterType, setFilterType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'CALL', subject: '', description: '', dueDate: '' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['crm-activities'],
    queryFn: () => api.get<Activity[]>('/api/crm/activities').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((a) => !filterType || a.type === filterType)

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/crm/activities', { ...form, dueDate: form.dueDate || undefined }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['crm-activities'] }); const previous = qc.getQueryData(['crm-activities'])
      qc.setQueryData(['crm-activities'], (old: any[]) => [{ ...form, id: 'temp-' + Date.now(), description: form.description || null, dueDate: form.dueDate || null, completedAt: null, createdAt: new Date().toISOString(), lead: null, contact: null, opportunity: null }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Activity logged') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['crm-activities'], context.previous); toast.error('Failed to save') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['crm-activities'] }); setShowForm(false); setForm({ type: 'CALL', subject: '', description: '', dueDate: '' }) },
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/crm/activities/${id}`, { completedAt: new Date().toISOString() }),
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: ['crm-activities'] }); const previous = qc.getQueryData(['crm-activities']); qc.setQueryData(['crm-activities'], (old: any[]) => old.map((item: any) => item.id === id ? { ...item, completedAt: new Date().toISOString() } : item)); return { previous } },
    onError: (err, id, context) => { if (context?.previous) qc.setQueryData(['crm-activities'], context.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm-activities'] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Activities" description="Calls, meetings, notes and follow-ups" actions={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Log Activity</Button>} />
      <div className="flex gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent><SelectItem value="">All</SelectItem>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
        </Select>
        {filterType && <Button variant="outline" size="sm" onClick={() => setFilterType('')}><X className="h-4 w-4 mr-1" />Clear</Button>}
      </div>
      <DataTable
        columns={[
          { key: 'type', header: 'Type', render: (r: Activity) => <Badge variant={TYPE_VARIANT[r.type] ?? 'secondary'}>{r.type.replace(/_/g,' ')}</Badge> },
          { key: 'subject', header: 'Subject' },
          { key: 'who', header: 'Related To', render: (r: Activity) => r.lead ? `${r.lead.firstName} ${r.lead.lastName}` : r.contact ? `${r.contact.firstName} ${r.contact.lastName}` : r.opportunity?.title ?? '—' },
          { key: 'dueDate', header: 'Due Date', render: (r: Activity) => r.dueDate ? formatDate(r.dueDate) : '—' },
          { key: 'status', header: 'Status', render: (r: Activity) => r.completedAt ? <Badge variant="success">Done</Badge> : <Badge variant="warning">Pending</Badge> },
        ]}
        data={filtered} isLoading={isLoading} error={error}
        actions={(row) => !row.completedAt ? <Button variant="ghost" size="icon" className="text-green-600" onClick={() => completeMutation.mutate(row.id)}><Check className="h-4 w-4" /></Button> : null}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Subject *</Label><Input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.subject}>{createMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
