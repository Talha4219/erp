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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type KpiTemplate = { id: string; name: string; description: string | null; category: string | null; targetType: string; unit: string | null; isActive: boolean }
type Employee = { id: string; firstName: string; lastName: string; employeeCode: string }
type EmployeeKpi = { id: string; year: number; quarter: number | null; target: number; actual: number | null; score: number | null; notes: string | null; employee: { id: string; firstName: string; lastName: string; employeeCode: string }; kpi: { id: string; name: string; category: string | null; targetType: string; unit: string | null } }

const emptyTemplate = { name: '', description: '', category: '', targetType: 'NUMERIC', unit: '', isActive: true }
function progress(actual: number | null, target: number) { if (actual == null) return null; return Math.min(100, Math.round((actual / target) * 100)) }

export function PageClient({ initialData }: { initialData: EmployeeKpi[] }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('tracking')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterEmployee, setFilterEmployee] = useState('')
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingKpi, setEditingKpi] = useState<EmployeeKpi | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [templateForm, setTemplateForm] = useState(emptyTemplate)
  const [editingTemplate, setEditingTemplate] = useState<KpiTemplate | null>(null)
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null)
  const [assignForm, setAssignForm] = useState({ employeeId: '', kpiId: '', year: String(new Date().getFullYear()), quarter: '', target: '', actual: '', notes: '' })

  const { data: kpis, isLoading, error: kpisError } = useQuery({
    queryKey: ['employee-kpis', filterYear, filterEmployee],
    queryFn: () => {
      const p = new URLSearchParams({ year: String(filterYear) })
      if (filterEmployee) p.set('employeeId', filterEmployee)
      return api.get<EmployeeKpi[]>(`/api/hr/performance/kpis?${p}`).then(r => r.data ?? [])
    },
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: ['kpi-templates'],
    queryFn: () => api.get<KpiTemplate[]>('/api/hr/performance/kpi-templates').then(r => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get<{ employees: Employee[] }>('/api/hr/employees').then(r => r.data?.employees ?? []),
    placeholderData: (prev) => prev,
  })

  const assignMutation = useMutation({
    mutationFn: (data: typeof assignForm) => api.post('/api/hr/performance/kpis', {
      employeeId: data.employeeId, kpiId: data.kpiId, notes: data.notes,
      year: Number(data.year), quarter: data.quarter ? Number(data.quarter) : null,
      target: parseFloat(data.target), actual: data.actual ? parseFloat(data.actual) : null,
    }),
    onSuccess: () => { toast.success('KPI assigned'); qc.invalidateQueries({ queryKey: ['employee-kpis'] }); setShowAssignForm(false) },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateKpiMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof assignForm> }) => api.put(`/api/hr/performance/kpis/${id}`, { target: parseFloat(data.target!), actual: data.actual ? parseFloat(data.actual) : null, notes: data.notes }),
    onSuccess: () => { toast.success('KPI updated'); qc.invalidateQueries({ queryKey: ['employee-kpis'] }); setEditingKpi(null) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteKpiMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/hr/performance/kpis/${id}`),
    onSuccess: () => { toast.success('KPI removed'); qc.invalidateQueries({ queryKey: ['employee-kpis'] }); setDeleteId(null) },
  })

  const saveTemplateMutation = useMutation({
    mutationFn: (data: typeof emptyTemplate) => editingTemplate ? api.put(`/api/hr/performance/kpi-templates/${editingTemplate.id}`, data) : api.post('/api/hr/performance/kpi-templates', data),
    onSuccess: () => { toast.success(editingTemplate ? 'Template updated' : 'Template created'); qc.invalidateQueries({ queryKey: ['kpi-templates'] }); setShowTemplateForm(false); setEditingTemplate(null); setTemplateForm(emptyTemplate) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/hr/performance/kpi-templates/${id}`),
    onSuccess: () => { toast.success('Template deleted'); qc.invalidateQueries({ queryKey: ['kpi-templates'] }); setDeleteTemplateId(null) },
  })

  const openEditTemplate = (t: KpiTemplate) => { setEditingTemplate(t); setTemplateForm({ name: t.name, description: t.description ?? '', category: t.category ?? '', targetType: t.targetType, unit: t.unit ?? '', isActive: t.isActive }); setShowTemplateForm(true) }

  const kpiCols = [
    { key: 'employee', header: 'Employee', render: (r: EmployeeKpi) => `${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'kpi', header: 'KPI', render: (r: EmployeeKpi) => r.kpi.name },
    { key: 'category', header: 'Category', render: (r: EmployeeKpi) => r.kpi.category ?? '-' },
    { key: 'period', header: 'Period', render: (r: EmployeeKpi) => r.quarter ? `Q${r.quarter} ${r.year}` : `${r.year}` },
    { key: 'target', header: 'Target', render: (r: EmployeeKpi) => `${Number(r.target)}${r.kpi.unit ? ' ' + r.kpi.unit : ''}` },
    { key: 'actual', header: 'Actual', render: (r: EmployeeKpi) => r.actual != null ? `${Number(r.actual)}${r.kpi.unit ? ' ' + r.kpi.unit : ''}` : '-' },
    { key: 'progress', header: 'Progress', render: (r: EmployeeKpi) => { const pct = progress(r.actual != null ? Number(r.actual) : null, Number(r.target)); if (pct == null) return <span className="text-muted-foreground">-</span>; return <div className="flex items-center gap-2"><div className="w-24 bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} /></div><span className="text-sm">{pct}%</span></div> } },
    { key: 'score', header: 'Score', render: (r: EmployeeKpi) => r.score != null ? `${Number(r.score).toFixed(1)}/5` : '-' },
  ]

  const templateCols = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'category', header: 'Category', render: (r: KpiTemplate) => r.category ?? '-' },
    { key: 'targetType', header: 'Type', render: (r: KpiTemplate) => <Badge variant="secondary">{r.targetType}</Badge> },
    { key: 'unit', header: 'Unit', render: (r: KpiTemplate) => r.unit ?? '-' },
    { key: 'description', header: 'Description', render: (r: KpiTemplate) => r.description ?? '-' },
    { key: 'isActive', header: 'Status', render: (r: KpiTemplate) => <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="KPIs" description="Track employee key performance indicators" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="tracking">Tracking</TabsTrigger><TabsTrigger value="templates">KPI Templates</TabsTrigger></TabsList>
        <TabsContent value="tracking" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap justify-between">
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2"><Label>Year</Label><Input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} className="w-24" /></div>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}><SelectTrigger className="w-52"><SelectValue placeholder="All employees" /></SelectTrigger><SelectContent><SelectItem value="">All Employees</SelectItem>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button onClick={() => setShowAssignForm(true)}><Plus className="mr-2 h-4 w-4" />Assign KPI</Button>
          </div>
          <DataTable columns={kpiCols} data={kpis ?? []} isLoading={isLoading} error={kpisError}
            actions={(row: EmployeeKpi) => <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditingKpi(row); setAssignForm({ ...assignForm, target: String(Number(row.target)), actual: row.actual != null ? String(Number(row.actual)) : '', notes: row.notes ?? '' }) }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button></div>}
          />
        </TabsContent>
        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="flex justify-end"><Button onClick={() => { setEditingTemplate(null); setTemplateForm(emptyTemplate); setShowTemplateForm(true) }}><Plus className="mr-2 h-4 w-4" />Add Template</Button></div>
          <DataTable columns={templateCols} data={templates} isLoading={templatesLoading} error={templatesError}
            actions={(row: KpiTemplate) => <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => openEditTemplate(row)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteTemplateId(row.id)}><Trash2 className="h-4 w-4" /></Button></div>}
          />
        </TabsContent>
      </Tabs>
      <Dialog open={showAssignForm} onOpenChange={setShowAssignForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign KPI</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Employee</Label><Select value={assignForm.employeeId} onValueChange={v => setAssignForm(f => ({ ...f, employeeId: v }))}><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>KPI</Label><Select value={assignForm.kpiId} onValueChange={v => setAssignForm(f => ({ ...f, kpiId: v }))}><SelectTrigger><SelectValue placeholder="Select KPI" /></SelectTrigger><SelectContent>{templates.filter(t => t.isActive).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Year</Label><Input type="number" value={assignForm.year} onChange={e => setAssignForm(f => ({ ...f, year: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Quarter</Label><Select value={assignForm.quarter} onValueChange={v => setAssignForm(f => ({ ...f, quarter: v }))}><SelectTrigger><SelectValue placeholder="Annual" /></SelectTrigger><SelectContent><SelectItem value="">Annual</SelectItem>{[1,2,3,4].map(q => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Target</Label><Input type="number" placeholder="100" value={assignForm.target} onChange={e => setAssignForm(f => ({ ...f, target: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Input placeholder="Optional notes" value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignForm(false)}>Cancel</Button>
            <Button disabled={assignMutation.isPending || !assignForm.employeeId || !assignForm.kpiId} onClick={() => assignMutation.mutate(assignForm)}>{assignMutation.isPending ? 'Assigning…' : 'Assign'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingKpi} onOpenChange={() => setEditingKpi(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Update KPI — {editingKpi?.kpi.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Target</Label><Input type="number" value={assignForm.target} onChange={e => setAssignForm(f => ({ ...f, target: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Actual</Label><Input type="number" placeholder="Enter actual value" value={assignForm.actual} onChange={e => setAssignForm(f => ({ ...f, actual: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Notes</Label><Input value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingKpi(null)}>Cancel</Button>
            <Button disabled={updateKpiMutation.isPending} onClick={() => editingKpi && updateKpiMutation.mutate({ id: editingKpi.id, data: assignForm })}>{updateKpiMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showTemplateForm} onOpenChange={setShowTemplateForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingTemplate ? 'Edit Template' : 'New KPI Template'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input placeholder="Sales Revenue" value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Category</Label><Input placeholder="Sales, Operations…" value={templateForm.category} onChange={e => setTemplateForm(f => ({ ...f, category: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Unit</Label><Input placeholder="£, %, units…" value={templateForm.unit} onChange={e => setTemplateForm(f => ({ ...f, unit: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Target Type</Label><Select value={templateForm.targetType} onValueChange={v => setTemplateForm(f => ({ ...f, targetType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NUMERIC">Numeric</SelectItem><SelectItem value="PERCENTAGE">Percentage</SelectItem><SelectItem value="BOOLEAN">Yes/No</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label>Description</Label><Input placeholder="What this KPI measures" value={templateForm.description} onChange={e => setTemplateForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateForm(false)}>Cancel</Button>
            <Button disabled={saveTemplateMutation.isPending} onClick={() => saveTemplateMutation.mutate(templateForm)}>{saveTemplateMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteKpiMutation.mutate(deleteId)} loading={deleteKpiMutation.isPending} title="Remove KPI" description="Remove this KPI assignment?" />
      <ConfirmDialog open={!!deleteTemplateId} onClose={() => setDeleteTemplateId(null)} onConfirm={() => deleteTemplateId && deleteTemplateMutation.mutate(deleteTemplateId)} loading={deleteTemplateMutation.isPending} title="Delete Template" description="Delete this KPI template?" />
    </div>
  )
}
