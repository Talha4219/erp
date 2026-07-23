'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Criterion = { id?: string; criteria: string; weight: number; selfScore: number | null; reviewerScore: number | null; comments: string }
type Appraisal = {
  id: string; period: string; year: number; status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'APPROVED'
  overallScore: number | null; selfComments: string | null; reviewerComments: string | null
  submittedAt: string | null; reviewedAt: string | null; approvedAt: string | null; criteria: Criterion[]
  employee: { firstName: string; lastName: string; employeeCode: string; department: { name: string } | null }
  reviewer: { id: string; firstName: string; lastName: string } | null
}
type Employee = { id: string; firstName: string; lastName: string }

const STATUS_FLOW: Record<string, string> = { DRAFT: 'SUBMITTED', SUBMITTED: 'REVIEWED', REVIEWED: 'APPROVED' }
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Submit for Review', SUBMITTED: 'Mark as Reviewed', REVIEWED: 'Approve' }
const statusVariant: Record<string, 'secondary' | 'warning' | 'success'> = { DRAFT: 'secondary', SUBMITTED: 'warning', REVIEWED: 'warning', APPROVED: 'success' }

export function PageClient({ id, initialData }: { id: string; initialData: Appraisal }) {
  const qc = useQueryClient()

  const { data: appraisal } = useQuery({
    queryKey: ['appraisal', id],
    queryFn: () => api.get<Appraisal>(`/api/hr/performance/appraisals/${id}`).then(r => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get<{ employees: Employee[] }>('/api/hr/employees').then(r => r.data?.employees ?? []),
  })

  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [selfComments, setSelfComments] = useState('')
  const [reviewerComments, setReviewerComments] = useState('')
  const [overallScore, setOverallScore] = useState('')
  const [reviewerId, setReviewerId] = useState('')
  const [dirty, setDirty] = useState(false)

  const onLoad = (a: Appraisal) => {
    if (!dirty) {
      setCriteria(a.criteria.map(c => ({ ...c, comments: c.comments ?? '' })))
      setSelfComments(a.selfComments ?? '')
      setReviewerComments(a.reviewerComments ?? '')
      setOverallScore(a.overallScore != null ? String(a.overallScore) : '')
      setReviewerId(a.reviewer?.id ?? '')
    }
  }
  if (appraisal && !dirty) onLoad(appraisal)

  const saveMutation = useMutation({
    mutationFn: (status?: string) => api.put(`/api/hr/performance/appraisals/${id}`, {
      criteria, selfComments, reviewerComments,
      overallScore: overallScore ? parseFloat(overallScore) : null,
      reviewerId: reviewerId || null,
      status: status ?? appraisal?.status,
    }),
    onSuccess: () => { toast.success('Appraisal saved'); qc.invalidateQueries({ queryKey: ['appraisal', id] }); qc.invalidateQueries({ queryKey: ['appraisals'] }); setDirty(false) },
    onError: (e: Error) => toast.error(e.message),
  })

  const addCriterion = () => { setCriteria(c => [...c, { criteria: '', weight: 1, selfScore: null, reviewerScore: null, comments: '' }]); setDirty(true) }
  const removeCriterion = (i: number) => { setCriteria(c => c.filter((_, idx) => idx !== i)); setDirty(true) }
  const updateCriterion = <K extends keyof Criterion>(i: number, key: K, val: Criterion[K]) => { setCriteria(c => c.map((cr, idx) => idx === i ? { ...cr, [key]: val } : cr)); setDirty(true) }

  const computedScore = criteria.length > 0
    ? criteria.reduce((sum, c) => { const score = c.reviewerScore ?? c.selfScore ?? 0; return sum + score * Number(c.weight) }, 0) / criteria.reduce((s, c) => s + Number(c.weight), 0)
    : null

  const nextStatus = STATUS_FLOW[appraisal.status]

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link href="/hr/performance/appraisals"><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>
        <div className="flex gap-2">
          <Button variant="outline" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(undefined)}>{saveMutation.isPending ? 'Saving…' : 'Save Draft'}</Button>
          {nextStatus && <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(nextStatus)}>{STATUS_LABEL[appraisal.status]}</Button>}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-start">
            <div><h2 className="text-xl font-semibold">{appraisal.employee.firstName} {appraisal.employee.lastName}</h2><p className="text-sm text-muted-foreground">{appraisal.employee.employeeCode} · {appraisal.employee.department?.name}</p><p className="text-sm mt-1">{appraisal.period.replace('_', ' ')} {appraisal.year}</p></div>
            <Badge variant={statusVariant[appraisal.status]}>{appraisal.status}</Badge>
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-xs text-muted-foreground">Reviewer</p>
              <Select value={reviewerId} onValueChange={v => { setReviewerId(v); setDirty(true) }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Assign reviewer" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><p className="text-xs text-muted-foreground">Computed Score</p><p className="text-2xl font-bold mt-1">{computedScore != null ? computedScore.toFixed(2) : '-'}<span className="text-sm font-normal text-muted-foreground"> / 5</span></p></div>
            <div><p className="text-xs text-muted-foreground">Override Score</p><Input type="number" min={0} max={5} step={0.1} placeholder="e.g. 4.5" value={overallScore} onChange={e => { setOverallScore(e.target.value); setDirty(true) }} className="mt-1" /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex items-center justify-between"><CardTitle>Assessment Criteria</CardTitle><Button size="sm" variant="outline" onClick={addCriterion}><Plus className="mr-1 h-3 w-3" />Add Criterion</Button></div></CardHeader>
        <CardContent className="space-y-4">
          {criteria.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No criteria yet. Click &quot;Add Criterion&quot; to start.</p>}
          {criteria.map((c, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-1"><Label className="text-xs">Criterion</Label><Input placeholder="e.g. Communication Skills" value={c.criteria} onChange={e => updateCriterion(i, 'criteria', e.target.value)} /></div>
                <div className="w-20 space-y-1"><Label className="text-xs">Weight</Label><Input type="number" min={0.1} step={0.1} value={c.weight} onChange={e => updateCriterion(i, 'weight', parseFloat(e.target.value) || 1)} /></div>
                <div className="w-24 space-y-1"><Label className="text-xs">Self Score</Label><Input type="number" min={0} max={5} step={0.5} placeholder="-" value={c.selfScore ?? ''} onChange={e => updateCriterion(i, 'selfScore', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div className="w-24 space-y-1"><Label className="text-xs">Reviewer Score</Label><Input type="number" min={0} max={5} step={0.5} placeholder="-" value={c.reviewerScore ?? ''} onChange={e => updateCriterion(i, 'reviewerScore', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <Button variant="ghost" size="icon" className="text-red-600 mt-5" onClick={() => removeCriterion(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1"><Label className="text-xs">Comments</Label><Input placeholder="Criterion-level comments" value={c.comments} onChange={e => updateCriterion(i, 'comments', e.target.value)} /></div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Self Assessment Comments</CardTitle></CardHeader><CardContent><Textarea placeholder="Employee's self-assessment notes…" value={selfComments} onChange={e => { setSelfComments(e.target.value); setDirty(true) }} rows={5} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Reviewer Comments</CardTitle></CardHeader><CardContent><Textarea placeholder="Reviewer's feedback…" value={reviewerComments} onChange={e => { setReviewerComments(e.target.value); setDirty(true) }} rows={5} /></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          {appraisal.submittedAt && <p><span className="text-muted-foreground">Submitted:</span> {new Date(appraisal.submittedAt).toLocaleString()}</p>}
          {appraisal.reviewedAt && <p><span className="text-muted-foreground">Reviewed:</span> {new Date(appraisal.reviewedAt).toLocaleString()}</p>}
          {appraisal.approvedAt && <p><span className="text-muted-foreground">Approved:</span> {new Date(appraisal.approvedAt).toLocaleString()}</p>}
          {!appraisal.submittedAt && <p className="text-muted-foreground">Not yet submitted.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
