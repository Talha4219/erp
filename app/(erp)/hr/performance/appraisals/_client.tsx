'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Eye } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type Appraisal = { id: string; period: string; year: number; status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'APPROVED'; overallScore: number | null; employee: { id: string; firstName: string; lastName: string; employeeCode: string; department: { name: string } | null }; reviewer: { id: string; firstName: string; lastName: string } | null; criteria: { id: string }[] }
type Employee = { id: string; firstName: string; lastName: string; employeeCode: string }

const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'MID_YEAR', 'ANNUAL']
const statusVariant: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = { DRAFT: 'secondary', SUBMITTED: 'warning', REVIEWED: 'warning', APPROVED: 'success' }

export function PageClient({ initialData }: { initialData: Appraisal[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [form, setForm] = useState({ employeeId: '', reviewerId: '', period: 'ANNUAL', year: new Date().getFullYear() })

  const { data, isLoading, error } = useQuery({
    queryKey: ['appraisals', filterYear, filterStatus, filterEmployee],
    queryFn: () => {
      const p = new URLSearchParams({ year: String(filterYear) })
      if (filterStatus) p.set('status', filterStatus)
      if (filterEmployee) p.set('employeeId', filterEmployee)
      return api.get<Appraisal[]>(`/api/hr/performance/appraisals?${p}`).then(r => r.data ?? [])
    },
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get<{ employees: Employee[] }>('/api/hr/employees').then(r => r.data?.employees ?? []),
    placeholderData: (prev) => prev,
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/api/hr/performance/appraisals', data),
    onSuccess: () => { toast.success('Appraisal created'); qc.invalidateQueries({ queryKey: ['appraisals'] }); setShowForm(false); setForm({ employeeId: '', reviewerId: '', period: 'ANNUAL', year: new Date().getFullYear() }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }))

  const columns = [
    { key: 'employee', header: 'Employee', render: (r: Appraisal) => `${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'department', header: 'Department', render: (r: Appraisal) => r.employee.department?.name ?? '-' },
    { key: 'period', header: 'Period', render: (r: Appraisal) => `${r.period.replace('_', ' ')} ${r.year}` },
    { key: 'reviewer', header: 'Reviewer', render: (r: Appraisal) => r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : '-' },
    { key: 'criteria', header: 'Criteria', render: (r: Appraisal) => `${r.criteria.length} criteria` },
    { key: 'overallScore', header: 'Score', render: (r: Appraisal) => r.overallScore != null ? <span className="font-semibold">{Number(r.overallScore).toFixed(1)} / 5</span> : '-' },
    { key: 'status', header: 'Status', render: (r: Appraisal) => <Badge variant={statusVariant[r.status]}>{r.status}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Appraisals" description="Manage employee performance appraisals"
        actions={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />New Appraisal</Button>}
      />
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2"><Label>Year</Label><Input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} className="w-24" /></div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent><SelectItem value="">All Statuses</SelectItem>{['DRAFT','SUBMITTED','REVIEWED','APPROVED'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All employees" /></SelectTrigger>
          <SelectContent><SelectItem value="">All Employees</SelectItem>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={data ?? []} isLoading={isLoading} error={error}
        actions={(row: Appraisal) => <Link href={`/hr/performance/appraisals/${row.id}`}><Button variant="ghost" size="icon" title="Open Appraisal"><Eye className="h-4 w-4" /></Button></Link>}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Appraisal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Employee</Label><Select value={form.employeeId} onValueChange={v => set('employeeId', v)}><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Reviewer <span className="text-muted-foreground text-xs">(optional)</span></Label><Select value={form.reviewerId} onValueChange={v => set('reviewerId', v)}><SelectTrigger><SelectValue placeholder="Select reviewer" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Period</Label><Select value={form.period} onValueChange={v => set('period', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PERIODS.map(p => <SelectItem key={p} value={p}>{p.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Year</Label><Input type="number" value={form.year} onChange={e => set('year', parseInt(e.target.value))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending || !form.employeeId} onClick={() => createMutation.mutate(form)}>{createMutation.isPending ? 'Creating…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
