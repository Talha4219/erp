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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

type Review = { id: string; reviewDate: string; reviewType: string; summary: string | null; strengths: string | null; improvements: string | null; actionItems: string | null; nextReviewDate: string | null; employee: { id: string; firstName: string; lastName: string; employeeCode: string; department: { name: string } | null }; reviewer: { id: string; firstName: string; lastName: string } | null }
type Employee = { id: string; firstName: string; lastName: string; employeeCode: string }

const REVIEW_TYPES = ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'PROBATION', 'PIP']
const typeVariant: Record<string, 'secondary' | 'warning' | 'destructive' | 'success'> = { MONTHLY: 'secondary', QUARTERLY: 'secondary', ANNUAL: 'success', PROBATION: 'warning', PIP: 'destructive' }
const emptyForm = { employeeId: '', reviewerId: '', reviewDate: new Date().toISOString().split('T')[0], reviewType: 'QUARTERLY', summary: '', strengths: '', improvements: '', actionItems: '', nextReviewDate: '' }

export function PageClient({ initialData }: { initialData: Review[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Review | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterType, setFilterType] = useState('')
  const [form, setForm] = useState(emptyForm)

  const { data, isLoading, error } = useQuery({
    queryKey: ['performance-reviews', filterEmployee, filterType],
    queryFn: () => {
      const p = new URLSearchParams()
      if (filterEmployee) p.set('employeeId', filterEmployee)
      if (filterType) p.set('reviewType', filterType)
      return api.get<Review[]>(`/api/hr/performance/reviews?${p}`).then(r => r.data ?? [])
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

  const saveMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => editing ? api.put(`/api/hr/performance/reviews/${editing.id}`, data) : api.post('/api/hr/performance/reviews', data),
    onSuccess: () => { toast.success(editing ? 'Review updated' : 'Review created'); qc.invalidateQueries({ queryKey: ['performance-reviews'] }); setShowForm(false); setEditing(null); setForm(emptyForm) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/hr/performance/reviews/${id}`),
    onSuccess: () => { toast.success('Review deleted'); qc.invalidateQueries({ queryKey: ['performance-reviews'] }); setDeleteId(null) },
  })

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (r: Review) => { setEditing(r); setForm({ employeeId: r.employee.id, reviewerId: r.reviewer?.id ?? '', reviewDate: r.reviewDate.split('T')[0], reviewType: r.reviewType, summary: r.summary ?? '', strengths: r.strengths ?? '', improvements: r.improvements ?? '', actionItems: r.actionItems ?? '', nextReviewDate: r.nextReviewDate ? r.nextReviewDate.split('T')[0] : '' }); setShowForm(true) }
  const set = <K extends keyof typeof emptyForm>(k: K, v: string) => setForm(f => ({ ...f, [k]: v }))

  const columns = [
    { key: 'reviewDate', header: 'Date', render: (r: Review) => formatDate(r.reviewDate), sortable: true },
    { key: 'employee', header: 'Employee', render: (r: Review) => `${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'department', header: 'Department', render: (r: Review) => r.employee.department?.name ?? '-' },
    { key: 'reviewer', header: 'Reviewer', render: (r: Review) => r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : '-' },
    { key: 'reviewType', header: 'Type', render: (r: Review) => <Badge variant={typeVariant[r.reviewType]}>{r.reviewType}</Badge> },
    { key: 'nextReviewDate', header: 'Next Review', render: (r: Review) => r.nextReviewDate ? formatDate(r.nextReviewDate) : '-' },
    { key: 'summary', header: 'Summary', render: (r: Review) => r.summary ? r.summary.slice(0, 60) + (r.summary.length > 60 ? '…' : '') : '-' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Performance Reviews" description="Record and track employee performance reviews" actions={<Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />New Review</Button>} />
      <div className="flex gap-3 flex-wrap">
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All employees" /></SelectTrigger>
          <SelectContent><SelectItem value="">All Employees</SelectItem>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent><SelectItem value="">All Types</SelectItem>{REVIEW_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        {(filterEmployee || filterType) && <Button variant="outline" size="sm" onClick={() => { setFilterEmployee(''); setFilterType('') }}>Clear</Button>}
      </div>
      <DataTable columns={columns} data={data ?? []} isLoading={isLoading} error={error}
        actions={(row: Review) => <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button></div>}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Review' : 'New Performance Review'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Employee</Label><Select value={form.employeeId} onValueChange={v => set('employeeId', v)}><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Reviewer <span className="text-muted-foreground text-xs">(optional)</span></Label><Select value={form.reviewerId} onValueChange={v => set('reviewerId', v)}><SelectTrigger><SelectValue placeholder="Select reviewer" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Review Date</Label><Input type="date" value={form.reviewDate} onChange={e => set('reviewDate', e.target.value)} /></div>
              <div className="space-y-1"><Label>Review Type</Label><Select value={form.reviewType} onValueChange={v => set('reviewType', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REVIEW_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Next Review Date</Label><Input type="date" value={form.nextReviewDate} onChange={e => set('nextReviewDate', e.target.value)} /></div>
            </div>
            {[{ key: 'summary', label: 'Summary' }, { key: 'strengths', label: 'Strengths' }, { key: 'improvements', label: 'Areas for Improvement' }, { key: 'actionItems', label: 'Action Items' }].map(({ key, label }) => (
              <div key={key} className="space-y-1"><Label>{label}</Label><Textarea placeholder={`${label}…`} value={form[key as keyof typeof emptyForm]} onChange={e => set(key as keyof typeof emptyForm, e.target.value)} rows={3} /></div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button disabled={saveMutation.isPending || !form.employeeId} onClick={() => saveMutation.mutate(form)}>{saveMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Review" description="Permanently delete this performance review?" />
    </div>
  )
}
