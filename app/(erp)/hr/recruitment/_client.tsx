'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Users, Briefcase } from 'lucide-react'
import { toast } from 'sonner'

type Department = { id: string; name: string }
type Job = { id: string; title: string; status: string; employmentType: string; openings: number; location: string | null; closingDate: string | null; department: { name: string }; _count: { applications: number } }
type Application = { id: string; firstName: string; lastName: string; email: string; status: string; source: string; appliedAt: string; rating: number | null }

const STATUS_COLORS: Record<string, string> = { DRAFT: 'bg-gray-100 text-gray-700', OPEN: 'bg-green-100 text-green-800', ON_HOLD: 'bg-yellow-100 text-yellow-800', CLOSED: 'bg-red-100 text-red-700', CANCELLED: 'bg-gray-200 text-gray-600' }
const APP_COLORS: Record<string, string> = { APPLIED: 'bg-blue-100 text-blue-800', SCREENING: 'bg-purple-100 text-purple-800', INTERVIEW: 'bg-yellow-100 text-yellow-800', OFFER: 'bg-orange-100 text-orange-800', HIRED: 'bg-green-100 text-green-800', REJECTED: 'bg-red-100 text-red-700', WITHDRAWN: 'bg-gray-100 text-gray-600' }

export function PageClient({ initialData }: { initialData: Job[] }) {
  const qc = useQueryClient()
  const [showJobForm, setShowJobForm] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Record<string, unknown>>()

  const { data: jobs, isLoading, error: jobsError } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get<Job[]>('/api/recruitment/jobs').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/api/hr/departments').then((r) => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const { data: applications = [], isLoading: appsLoading, error: appsError } = useQuery({
    queryKey: ['applications', selectedJobId],
    queryFn: () => api.get<Application[]>(`/api/recruitment/jobs/${selectedJobId}/applications`).then((r) => r.data ?? []),
    enabled: !!selectedJobId,
    placeholderData: (prev) => prev,
  })

  const createJob = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/api/recruitment/jobs', d),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['jobs'] }); const previous = qc.getQueryData(['jobs'])
      qc.setQueryData(['jobs'], (old: any[]) => [{ ...newData, id: 'temp-' + Date.now(), _count: { applications: 0 }, status: (newData as any).status || 'DRAFT' }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Job posted') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['jobs'], context.previous); toast.error('Failed to create job posting') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); setShowJobForm(false); reset() },
  })

  const jobColumns = [
    { key: 'title', header: 'Job Title' },
    { key: 'department', header: 'Department', render: (r: Job) => r.department.name },
    { key: 'status', header: 'Status', render: (r: Job) => <Badge className={STATUS_COLORS[r.status] ?? ''}>{r.status}</Badge> },
    { key: 'employmentType', header: 'Type', render: (r: Job) => r.employmentType.replace('_', ' ') },
    { key: 'openings', header: 'Openings' },
    { key: 'applications', header: 'Applications', render: (r: Job) => <button className="font-semibold text-blue-600 hover:underline" onClick={() => setSelectedJobId(r.id)}>{r._count.applications}</button> },
    { key: 'closingDate', header: 'Closing', render: (r: Job) => r.closingDate ? new Date(r.closingDate).toLocaleDateString('en-GB') : '—' },
  ]

  const appColumns = [
    { key: 'name', header: 'Applicant', render: (r: Application) => `${r.firstName} ${r.lastName}` },
    { key: 'email', header: 'Email' },
    { key: 'status', header: 'Status', render: (r: Application) => <Badge className={APP_COLORS[r.status] ?? ''}>{r.status}</Badge> },
    { key: 'source', header: 'Source' },
    { key: 'rating', header: 'Rating', render: (r: Application) => r.rating ? '★'.repeat(r.rating) : '—' },
    { key: 'appliedAt', header: 'Applied', render: (r: Application) => new Date(r.appliedAt).toLocaleDateString('en-GB') },
  ]

  const selectedJob = (jobs ?? []).find((j) => j.id === selectedJobId)

  return (
    <>
      <PageHeader title="Recruitment" description="Manage job postings, applications, and interviews" actions={<Button onClick={() => setShowJobForm(true)}><Plus className="h-4 w-4 mr-1" />New Job Posting</Button>} />
      <Tabs defaultValue="jobs">
        <TabsList className="mb-4">
          <TabsTrigger value="jobs"><Briefcase className="h-4 w-4 mr-1" />Job Postings ({(jobs ?? []).length})</TabsTrigger>
          {selectedJobId && <TabsTrigger value="applications"><Users className="h-4 w-4 mr-1" />Applications — {selectedJob?.title}</TabsTrigger>}
        </TabsList>
        <TabsContent value="jobs"><DataTable columns={jobColumns} data={jobs ?? []} isLoading={isLoading} error={jobsError} /></TabsContent>
        {selectedJobId && (
          <TabsContent value="applications">
            <div className="mb-3"><Button variant="outline" size="sm" onClick={() => setSelectedJobId(null)}>← Back to Jobs</Button></div>
            <DataTable columns={appColumns} data={applications} isLoading={appsLoading} error={appsError} />
          </TabsContent>
        )}
      </Tabs>
      <Dialog open={showJobForm} onOpenChange={(o) => { if (!o) { setShowJobForm(false); reset() } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Job Posting</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createJob.mutate(d))} className="space-y-3">
            <div className="space-y-1"><Label>Job Title *</Label><Input {...register('title', { required: true })} placeholder="e.g. Senior Software Engineer" />{errors.title && <p className="text-xs text-red-500">Required</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Department *</Label><Select onValueChange={(v) => setValue('departmentId', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Employment Type</Label><Select defaultValue="FULL_TIME" onValueChange={(v) => setValue('employmentType', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['FULL_TIME','PART_TIME','CONTRACT','INTERN'].map((t) => <SelectItem key={t} value={t}>{t.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Openings</Label><Input {...register('openings', { valueAsNumber: true })} type="number" min={1} defaultValue={1} /></div>
              <div className="space-y-1"><Label>Location</Label><Input {...register('location')} placeholder="e.g. London, Remote" /></div>
              <div className="space-y-1"><Label>Salary Min (GBP)</Label><Input {...register('salaryMin', { valueAsNumber: true })} type="number" /></div>
              <div className="space-y-1"><Label>Salary Max (GBP)</Label><Input {...register('salaryMax', { valueAsNumber: true })} type="number" /></div>
            </div>
            <div className="space-y-1"><Label>Closing Date</Label><Input {...register('closingDate')} type="date" /></div>
            <div className="space-y-1"><Label>Description *</Label><textarea {...register('description', { required: true })} rows={3} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Role description and responsibilities…" />{errors.description && <p className="text-xs text-red-500">Required</p>}</div>
            <div className="space-y-1"><Label>Status</Label><Select defaultValue="DRAFT" onValueChange={(v) => setValue('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['DRAFT','OPEN','ON_HOLD'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowJobForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createJob.isPending}>{createJob.isPending ? 'Posting…' : 'Post Job'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
