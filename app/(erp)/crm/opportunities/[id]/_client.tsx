'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const STAGES = ['PROSPECTING','QUALIFICATION','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST']
const ACTIVITY_TYPES = ['CALL','MEETING','NOTE','FOLLOW_UP','EMAIL_LOG','TASK']
const STAGE_VARIANT: Record<string, 'success'|'destructive'|'warning'|'info'|'secondary'> = { CLOSED_WON: 'success', CLOSED_LOST: 'destructive', NEGOTIATION: 'warning', PROPOSAL: 'info', QUALIFICATION: 'info', PROSPECTING: 'secondary' }

type OppDetail = { id: string; title: string; stage: string; probability: number; value: number; expectedClose: string | null; notes: string | null; assignedTo: string | null; lead: { id: string; firstName: string; lastName: string } | null; contact: { id: string; firstName: string; lastName: string } | null; customer: { id: string; name: string } | null; activities: Array<{ id: string; type: string; subject: string; description: string | null; dueDate: string | null; completedAt: string | null; createdAt: string }> }

export function PageClient({ id, initialData }: { id: string; initialData: OppDetail }) {
  const qc = useQueryClient()
  const [showActivity, setShowActivity] = useState(false)
  const [actForm, setActForm] = useState({ type: 'CALL', subject: '', description: '', dueDate: '' })

  const { data: opp } = useQuery({
    queryKey: ['crm-opp', id],
    queryFn: () => api.get<OppDetail>(`/api/crm/opportunities/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const stageMutation = useMutation({
    mutationFn: (stage: string) => api.patch(`/api/crm/opportunities/${id}`, { stage }),
    onMutate: async (stage) => {
      await qc.cancelQueries({ queryKey: ['crm-opp', id] })
      const previous = qc.getQueryData(['crm-opp', id])
      qc.setQueryData(['crm-opp', id], (old: OppDetail | undefined) => old ? { ...old, stage } : old)
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['crm-opp', id], context.previous)
      toast.error('Failed to update stage')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm-opp', id] }),
  })
  const activityMutation = useMutation({
    mutationFn: () => api.post('/api/crm/activities', { ...actForm, opportunityId: id }),
    onSuccess: () => { toast.success('Activity logged'); qc.invalidateQueries({ queryKey: ['crm-opp', id] }); setShowActivity(false); setActForm({ type: 'CALL', subject: '', description: '', dueDate: '' }) },
    onError: () => toast.error('Failed to log activity'),
  })
  const completeMutation = useMutation({
    mutationFn: (actId: string) => api.patch(`/api/crm/activities/${actId}`, { completedAt: new Date().toISOString() }),
    onMutate: async (actId) => {
      await qc.cancelQueries({ queryKey: ['crm-opp', id] })
      const previous = qc.getQueryData(['crm-opp', id])
      qc.setQueryData(['crm-opp', id], (old: OppDetail | undefined) => {
        if (!old) return old
        return { ...old, activities: old.activities.map((a) => a.id === actId ? { ...a, completedAt: new Date().toISOString() } : a) }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => { if (context?.previous) qc.setQueryData(['crm-opp', id], context.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm-opp', id] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader title={opp.title} description={opp.customer?.name ?? opp.contact ? `${opp.contact?.firstName} ${opp.contact?.lastName}` : ''}
        actions={<Button variant="outline" asChild><Link href="/crm/opportunities"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Stage</p><div className="mt-2"><Badge variant={STAGE_VARIANT[opp.stage] ?? 'secondary'}>{opp.stage.replace(/_/g,' ')}</Badge></div></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Value</p><p className="mt-1 text-lg font-bold">{formatCurrency(Number(opp.value))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Probability</p><p className="mt-1 font-semibold">{opp.probability}%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Expected Close</p><p className="mt-1 font-semibold text-sm">{opp.expectedClose ? formatDate(opp.expectedClose) : '—'}</p></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><CardContent className="flex items-center gap-4 pt-4">
          <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">Move Stage:</p>
          <Select value={opp.stage} onValueChange={(v) => stageMutation.mutate(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          {opp.lead && <p className="text-sm"><span className="text-muted-foreground">Lead: </span><Link href={`/crm/leads/${opp.lead.id}`} className="text-primary hover:underline">{opp.lead.firstName} {opp.lead.lastName}</Link></p>}
          {opp.contact && <p className="text-sm"><span className="text-muted-foreground">Contact: </span>{opp.contact.firstName} {opp.contact.lastName}</p>}
          {opp.customer && <p className="text-sm"><span className="text-muted-foreground">Company: </span>{opp.customer.name}</p>}
          {opp.notes && <p className="mt-2 text-xs text-muted-foreground">{opp.notes}</p>}
        </CardContent></Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Activities</CardTitle><Button size="sm" onClick={() => setShowActivity(true)}><Plus className="mr-2 h-4 w-4" />Log</Button></CardHeader>
        <CardContent className="space-y-3">
          {showActivity && (
            <div className="rounded-lg border bg-muted/30 p-4 grid grid-cols-2 gap-3">
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
                <Button size="sm" onClick={() => activityMutation.mutate()} disabled={!actForm.subject}>{activityMutation.isPending ? 'Saving…' : 'Save'}</Button>
                <Button size="sm" variant="outline" onClick={() => setShowActivity(false)}>Cancel</Button>
              </div>
            </div>
          )}
          {opp.activities.length === 0 && !showActivity && <p className="text-sm text-muted-foreground">No activities yet.</p>}
          {opp.activities.map((a) => (
            <div key={a.id} className={`flex items-start gap-3 rounded-lg border p-3 ${a.completedAt ? 'opacity-60' : ''}`}>
              <div className="flex-1"><p className="text-sm font-medium">{a.subject}</p><p className="text-xs text-muted-foreground">{a.type.replace(/_/g,' ')} {a.dueDate ? `· Due ${formatDate(a.dueDate)}` : ''}</p>{a.description && <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>}</div>
              {!a.completedAt && <Button size="icon" variant="ghost" className="text-green-600 h-7 w-7" onClick={() => completeMutation.mutate(a.id)}><Check className="h-4 w-4" /></Button>}
              {a.completedAt && <span className="text-xs text-green-600 font-medium">Done</span>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
