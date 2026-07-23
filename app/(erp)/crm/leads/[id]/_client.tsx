'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const STATUSES = ['NEW','CONTACTED','QUALIFIED','UNQUALIFIED','CONVERTED']
const ACTIVITY_TYPES = ['CALL','MEETING','NOTE','FOLLOW_UP','EMAIL_LOG','TASK']
const STATUS_VARIANT: Record<string, 'success'|'info'|'warning'|'destructive'|'secondary'> = { NEW: 'info', CONTACTED: 'warning', QUALIFIED: 'success', UNQUALIFIED: 'secondary', CONVERTED: 'success' }

type LeadDetail = {
  id: string; firstName: string; lastName: string; email: string | null; phone: string | null
  company: string | null; jobTitle: string | null; source: string; status: string; notes: string | null
  campaign: { name: string } | null
  activities: Array<{ id: string; type: string; subject: string; description: string | null; dueDate: string | null; completedAt: string | null; createdAt: string }>
  opportunity: { id: string; title: string; stage: string } | null
}

export function PageClient({ id, initialData }: { id: string; initialData: LeadDetail }) {
  const qc = useQueryClient()
  const [showActivity, setShowActivity] = useState(false)
  const [actForm, setActForm] = useState({ type: 'CALL', subject: '', description: '', dueDate: '' })

  const { data: lead } = useQuery({
    queryKey: ['crm-lead', id],
    queryFn: () => api.get<LeadDetail>(`/api/crm/leads/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/api/crm/leads/${id}`, { status }),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: ['crm-lead', id] })
      const previous = qc.getQueryData(['crm-lead', id])
      qc.setQueryData(['crm-lead', id], (old: LeadDetail | undefined) => old ? { ...old, status } : old)
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['crm-lead', id], context.previous)
      toast.error('Failed to update status')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm-lead', id] }),
  })
  const activityMutation = useMutation({
    mutationFn: () => api.post('/api/crm/activities', { ...actForm, leadId: id }),
    onSuccess: () => { toast.success('Activity logged'); qc.invalidateQueries({ queryKey: ['crm-lead', id] }); setShowActivity(false); setActForm({ type: 'CALL', subject: '', description: '', dueDate: '' }) },
    onError: () => toast.error('Failed to log activity'),
  })
  const completeMutation = useMutation({
    mutationFn: (actId: string) => api.patch(`/api/crm/activities/${actId}`, { completedAt: new Date().toISOString() }),
    onMutate: async (actId) => {
      await qc.cancelQueries({ queryKey: ['crm-lead', id] })
      const previous = qc.getQueryData(['crm-lead', id])
      qc.setQueryData(['crm-lead', id], (old: LeadDetail | undefined) => {
        if (!old) return old
        return { ...old, activities: old.activities.map((a) => a.id === actId ? { ...a, completedAt: new Date().toISOString() } : a) }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => { if (context?.previous) qc.setQueryData(['crm-lead', id], context.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm-lead', id] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader title={`${lead.firstName} ${lead.lastName}`} description={lead.company ?? lead.email ?? ''} actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/crm/leads"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        </div>
      } />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Status</p><div className="mt-2"><Badge variant={STATUS_VARIANT[lead.status] ?? 'secondary'}>{lead.status}</Badge></div></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Source</p><p className="mt-1 font-semibold text-sm">{lead.source.replace(/_/g,' ')}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Campaign</p><p className="mt-1 font-semibold text-sm">{lead.campaign?.name ?? '—'}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Opportunity</p><p className="mt-1 text-sm">{lead.opportunity ? <Link href={`/crm/opportunities/${lead.opportunity.id}`} className="text-primary hover:underline">{lead.opportunity.title}</Link> : '—'}</p></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[['Email', lead.email],['Phone', lead.phone],['Job Title', lead.jobTitle],['Company', lead.company]].map(([l, v]) => v ? <div key={l}><span className="text-muted-foreground">{l}: </span>{v}</div> : null)}
            {lead.notes && <div className="pt-2 text-xs text-muted-foreground border-t">{lead.notes}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-4">
            <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">Update Status:</p>
            <Select value={lead.status} onValueChange={(v) => statusMutation.mutate(v)} disabled={statusMutation.isPending}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <Button size="sm" onClick={() => setShowActivity(true)} className="w-full"><Plus className="mr-2 h-4 w-4" />Log Activity</Button>
          </CardContent>
        </Card>
      </div>
      {showActivity && (
        <Card>
          <CardHeader><CardTitle className="text-base">Log Activity</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Type</Label>
              <Select value={actForm.type} onValueChange={(v) => setActForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIVITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Subject *</Label><Input value={actForm.subject} onChange={(e) => setActForm((p) => ({ ...p, subject: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Due Date</Label><Input type="date" value={actForm.dueDate} onChange={(e) => setActForm((p) => ({ ...p, dueDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={actForm.description} onChange={(e) => setActForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="col-span-2 flex gap-2">
              <Button size="sm" onClick={() => activityMutation.mutate()} disabled={activityMutation.isPending || !actForm.subject}>{activityMutation.isPending ? 'Saving…' : 'Save'}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowActivity(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Activities</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {lead.activities.length === 0 ? <p className="text-sm text-muted-foreground">No activities yet.</p> : lead.activities.map((a) => (
            <div key={a.id} className={`flex items-start gap-3 rounded-lg border p-3 ${a.completedAt ? 'opacity-60' : ''}`}>
              <div className="flex-1">
                <p className="text-sm font-medium">{a.subject}</p>
                <p className="text-xs text-muted-foreground">{a.type.replace(/_/g,' ')} {a.dueDate ? `· Due ${formatDate(a.dueDate)}` : ''}</p>
                {a.description && <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>}
              </div>
              {!a.completedAt && <Button size="icon" variant="ghost" className="text-green-600 h-7 w-7" onClick={() => completeMutation.mutate(a.id)}><Check className="h-4 w-4" /></Button>}
              {a.completedAt && <span className="text-xs text-green-600 font-medium">Done</span>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
