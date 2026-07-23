'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { Plus, Pencil, Trash2, CheckCircle2, Circle, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

type TemplateTask = { id?: string; title: string; description?: string; dueAfterDays: number; assignedRole: string; sortOrder: number }
type Template = { id: string; name: string; type: 'ONBOARDING' | 'OFFBOARDING'; isActive: boolean; tasks: TemplateTask[] }
type Employee = { id: string; firstName: string; lastName: string; employeeCode: string }
type OnboardingTask = { id: string; title: string; description?: string; assignedRole?: string; dueDate?: string; completedAt?: string; notes?: string; sortOrder: number }
type Onboarding = { id: string; employeeId: string; type: 'ONBOARDING' | 'OFFBOARDING'; startDate: string; completedAt?: string; notes?: string; tasks: OnboardingTask[]; employee?: Employee }

const emptyTemplate = (): Omit<Template, 'id'> => ({ name: '', type: 'ONBOARDING', isActive: true, tasks: [] })

export function PageClient({ initialData }: { initialData: Template[] }) {
  const qc = useQueryClient()
  const [templateForm, setTemplateForm] = useState(emptyTemplate())
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null)
  const [showStartForm, setShowStartForm] = useState(false)
  const [startForm, setStartForm] = useState({ employeeId: '', templateId: '', type: 'ONBOARDING' as 'ONBOARDING' | 'OFFBOARDING', startDate: '', notes: '' })
  const [selectedOnboarding, setSelectedOnboarding] = useState<Onboarding | null>(null)

  const { data: templates, isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: ['onboarding-templates'],
    queryFn: () => api.get<Template[]>('/api/hr/onboarding').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get<{ employees: Employee[] }>('/api/hr/employees').then((r) => r.data?.employees ?? []),
    placeholderData: (prev) => prev,
  })

  const { data: activeOnboardings = [], isLoading: onboardingsLoading } = useQuery({
    queryKey: ['all-onboardings'],
    queryFn: async () => {
      const results: Onboarding[] = []
      for (const emp of employees.slice(0, 50)) {
        const r = await api.get<Onboarding[]>(`/api/hr/employees/${emp.id}/onboarding`)
        const items = (r.data ?? []).map((o) => ({ ...o, employee: emp }))
        results.push(...items)
      }
      return results.filter((o) => !o.completedAt)
    },
    enabled: employees.length > 0,
  })

  const saveTemplateMut = useMutation({
    mutationFn: (t: Omit<Template, 'id'> & { id?: string }) =>
      t.id ? api.put(`/api/hr/onboarding/${t.id}`, t) : api.post('/api/hr/onboarding', t),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['onboarding-templates'] }); const previous = qc.getQueryData(['onboarding-templates'])
      qc.setQueryData(['onboarding-templates'], (old: any[]) => newData.id ? old.map((item: any) => item.id === newData.id ? { ...item, ...newData } : item) : [{ ...newData, id: 'temp-' + Date.now(), isActive: true }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Template saved') },
    onError: (e: Error, _newData, context) => { if (context?.previous) qc.setQueryData(['onboarding-templates'], context.previous); toast.error(e.message) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['onboarding-templates'] }); setShowTemplateForm(false); setEditingTemplate(null); setTemplateForm(emptyTemplate()) },
  })

  const deleteTemplateMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/hr/onboarding/${id}`),
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: ['onboarding-templates'] }); const previous = qc.getQueryData(['onboarding-templates']); qc.setQueryData(['onboarding-templates'], (old: any[]) => old.filter((item: any) => item.id !== id)); return { previous } },
    onSuccess: () => { toast.success('Template deleted') },
    onError: (e: Error, id, context) => { if (context?.previous) qc.setQueryData(['onboarding-templates'], context.previous); toast.error(e.message) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['onboarding-templates'] }); setDeleteTemplateId(null) },
  })

  const startOnboardingMut = useMutation({
    mutationFn: ({ employeeId, ...rest }: typeof startForm) => api.post(`/api/hr/employees/${employeeId}/onboarding`, rest),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['all-onboardings'] }); const previous = qc.getQueryData(['all-onboardings'])
      const employee = employees.find(e => e.id === newData.employeeId)
      qc.setQueryData(['all-onboardings'], (old: any[]) => [{ ...newData, id: 'temp-' + Date.now(), employee: employee ?? { id: newData.employeeId, firstName: '', lastName: '', employeeCode: '' }, tasks: [], completedAt: null }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Onboarding started') },
    onError: (e: Error, _newData, context) => { if (context?.previous) qc.setQueryData(['all-onboardings'], context.previous); toast.error(e.message) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['all-onboardings'] }); setShowStartForm(false); setStartForm({ employeeId: '', templateId: '', type: 'ONBOARDING', startDate: '', notes: '' }) },
  })

  const completeTaskMut = useMutation({
    mutationFn: ({ onboarding, taskId, completed }: { onboarding: Onboarding; taskId: string; completed: boolean }) => api.patch(`/api/hr/employees/${onboarding.employeeId}/onboarding/${onboarding.id}/tasks/${taskId}`, { completed }),
    onMutate: async ({ onboarding, taskId, completed }) => { await qc.cancelQueries({ queryKey: ['all-onboardings'] }); const previous = qc.getQueryData(['all-onboardings']); qc.setQueryData(['all-onboardings'], (old: any[]) => old.map((ob: any) => ob.id === onboarding.id ? { ...ob, tasks: ob.tasks.map((t: any) => t.id === taskId ? { ...t, completedAt: completed ? new Date().toISOString() : null } : t) } : ob)); return { previous } },
    onError: (e: Error, vars, context) => { if (context?.previous) qc.setQueryData(['all-onboardings'], context.previous); toast.error(e.message) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['all-onboardings'] }); if (selectedOnboarding) { qc.invalidateQueries({ queryKey: ['onboarding', selectedOnboarding.id] }) } },
  })

  function addTemplateTask() { setTemplateForm((f) => ({ ...f, tasks: [...f.tasks, { title: '', description: '', dueAfterDays: 0, assignedRole: 'HR', sortOrder: f.tasks.length }] })) }
  function removeTemplateTask(i: number) { setTemplateForm((f) => ({ ...f, tasks: f.tasks.filter((_, idx) => idx !== i) })) }
  function updateTemplateTask(i: number, field: keyof TemplateTask, value: string | number) { setTemplateForm((f) => { const tasks = [...f.tasks]; tasks[i] = { ...tasks[i], [field]: value }; return { ...f, tasks } }) }
  function openEditTemplate(t: Template) { setEditingTemplate(t); setTemplateForm({ name: t.name, type: t.type, isActive: t.isActive, tasks: t.tasks.map((tk) => ({ ...tk })) }); setShowTemplateForm(true) }

  const templateColumns = [
    { key: 'name', header: 'Template Name' },
    { key: 'type', header: 'Type', render: (row: Template) => <Badge variant={row.type === 'ONBOARDING' ? 'default' : 'secondary'}>{row.type}</Badge> },
    { key: 'tasks', header: 'Tasks', render: (row: Template) => <span>{row.tasks.length} tasks</span> },
    { key: 'isActive', header: 'Status', render: (row: Template) => <Badge variant={row.isActive ? 'default' : 'outline'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', header: '', render: (row: Template) => <div className="flex gap-2 justify-end"><Button size="sm" variant="ghost" onClick={() => openEditTemplate(row)}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTemplateId(row.id)}><Trash2 className="h-4 w-4" /></Button></div> },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Onboarding & Offboarding" description="Manage checklists and track employee onboarding/offboarding progress" />
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({activeOnboardings.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({(templates ?? []).length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-4 mt-4">
          <div className="flex justify-end"><Button onClick={() => setShowStartForm(true)}><Plus className="h-4 w-4 mr-2" />Start Onboarding</Button></div>
          {onboardingsLoading ? <div className="text-center text-muted-foreground py-8">Loading…</div>
          : activeOnboardings.length === 0 ? <div className="text-center text-muted-foreground py-8">No active onboarding processes</div>
          : <div className="grid gap-4">{activeOnboardings.map((ob) => {
            const done = ob.tasks.filter((t) => t.completedAt).length
            const pct = ob.tasks.length > 0 ? Math.round((done / ob.tasks.length) * 100) : 0
            return <Card key={ob.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedOnboarding(ob)}>
              <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base">{ob.employee?.firstName} {ob.employee?.lastName}<Badge variant={ob.type === 'ONBOARDING' ? 'default' : 'secondary'} className="ml-2 text-xs">{ob.type}</Badge></CardTitle><span className="text-sm text-muted-foreground">{pct}% complete</span></div></CardHeader>
              <CardContent><div className="w-full bg-muted rounded-full h-1.5 mb-2"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} /></div><div className="text-xs text-muted-foreground">{done}/{ob.tasks.length} tasks · Started {format(new Date(ob.startDate), 'dd MMM yyyy')}</div></CardContent>
            </Card>
          })}</div>}
        </TabsContent>
        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="flex justify-end"><Button onClick={() => { setTemplateForm(emptyTemplate()); setShowTemplateForm(true) }}><Plus className="h-4 w-4 mr-2" />New Template</Button></div>
          <DataTable columns={templateColumns} data={templates ?? []} isLoading={templatesLoading} error={templatesError} />
        </TabsContent>
      </Tabs>
      {selectedOnboarding && (
        <Dialog open onOpenChange={() => setSelectedOnboarding(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{selectedOnboarding.employee?.firstName} {selectedOnboarding.employee?.lastName} — {selectedOnboarding.type}</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectedOnboarding.tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded border hover:bg-muted/30">
                  <button onClick={() => completeTaskMut.mutate({ onboarding: selectedOnboarding, taskId: task.id, completed: !task.completedAt })} className="mt-0.5 flex-shrink-0">
                    {task.completedAt ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.completedAt ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                    {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {task.assignedRole && <span>Assigned: {task.assignedRole}</span>}
                      {task.dueDate && <span>Due: {format(new Date(task.dueDate), 'dd MMM')}</span>}
                      {task.completedAt && <span className="text-green-600">Done {format(new Date(task.completedAt), 'dd MMM')}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setSelectedOnboarding(null)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={showStartForm} onOpenChange={(o) => !o && setShowStartForm(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Start Onboarding / Offboarding</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); startOnboardingMut.mutate(startForm) }} className="space-y-4">
            <div className="space-y-1"><Label>Employee</Label><Select value={startForm.employeeId} onValueChange={(v) => setStartForm((f) => ({ ...f, employeeId: v }))}><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Type</Label><Select value={startForm.type} onValueChange={(v) => setStartForm((f) => ({ ...f, type: v as 'ONBOARDING' | 'OFFBOARDING' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ONBOARDING">Onboarding</SelectItem><SelectItem value="OFFBOARDING">Offboarding</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={startForm.startDate} onChange={(e) => setStartForm((f) => ({ ...f, startDate: e.target.value }))} required /></div>
            </div>
            <div className="space-y-1"><Label>Template (optional)</Label><Select value={startForm.templateId} onValueChange={(v) => setStartForm((f) => ({ ...f, templateId: v }))}><SelectTrigger><SelectValue placeholder="No template (manual tasks)" /></SelectTrigger><SelectContent><SelectItem value="">No template</SelectItem>{(templates ?? []).filter((t) => t.type === startForm.type && t.isActive).map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.tasks.length} tasks)</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={startForm.notes} onChange={(e) => setStartForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowStartForm(false)}>Cancel</Button>
              <Button type="submit" disabled={startOnboardingMut.isPending || !startForm.employeeId || !startForm.startDate}>{startOnboardingMut.isPending ? 'Starting…' : 'Start'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={showTemplateForm} onOpenChange={(o) => !o && setShowTemplateForm(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveTemplateMut.mutate(editingTemplate ? { ...templateForm, id: editingTemplate.id } : templateForm) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Name</Label><Input value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} required /></div>
              <div className="space-y-1"><Label>Type</Label><Select value={templateForm.type} onValueChange={(v) => setTemplateForm((f) => ({ ...f, type: v as 'ONBOARDING' | 'OFFBOARDING' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ONBOARDING">Onboarding</SelectItem><SelectItem value="OFFBOARDING">Offboarding</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Tasks</Label><Button type="button" size="sm" variant="outline" onClick={addTemplateTask}><Plus className="h-3.5 w-3.5 mr-1" />Add Task</Button></div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {templateForm.tasks.map((task, i) => (
                  <div key={i} className="flex gap-2 items-start border rounded p-2">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <Input className="col-span-2" placeholder="Task title" value={task.title} onChange={(e) => updateTemplateTask(i, 'title', e.target.value)} />
                      <Input placeholder="Role (HR, IT…)" value={task.assignedRole} onChange={(e) => updateTemplateTask(i, 'assignedRole', e.target.value)} />
                      <Input className="col-span-2" placeholder="Description" value={task.description ?? ''} onChange={(e) => updateTemplateTask(i, 'description', e.target.value)} />
                      <div className="flex items-center gap-1"><Input type="number" min="0" placeholder="Days" value={task.dueAfterDays} onChange={(e) => updateTemplateTask(i, 'dueAfterDays', parseInt(e.target.value) || 0)} /><span className="text-xs text-muted-foreground whitespace-nowrap">d after</span></div>
                    </div>
                    <button type="button" onClick={() => removeTemplateTask(i)} className="text-destructive mt-1"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                {templateForm.tasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No tasks yet &mdash; click &ldquo;Add Task&rdquo;</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTemplateForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saveTemplateMut.isPending}>{saveTemplateMut.isPending ? 'Saving…' : 'Save Template'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteTemplateId} onClose={() => setDeleteTemplateId(null)} title="Delete Template" description="Delete this onboarding template? Existing employee onboardings using it are not affected." onConfirm={() => deleteTemplateId && deleteTemplateMut.mutate(deleteTemplateId)} loading={deleteTemplateMut.isPending} />
    </div>
  )
}
