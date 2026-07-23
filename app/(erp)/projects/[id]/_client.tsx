'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api-client'
import { taskSchema, type TaskInput } from '@/lib/validations/projects'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import type { Resolver } from 'react-hook-form'

type ProjectDetail = { id: string; code: string; name: string; description: string | null; status: string; startDate: string; endDate: string | null; budget: number; actualCost: number; progress: number }
type Task = { id: string; title: string; description: string | null; status: string; priority: string; startDate: string | null; dueDate: string | null; assignee: { name: string | null; email: string } | null }

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = { PLANNING: 'secondary', ACTIVE: 'success', ON_HOLD: 'warning', COMPLETED: 'default', CANCELLED: 'destructive' }
const taskStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'info'> = { TODO: 'secondary', IN_PROGRESS: 'info', REVIEW: 'warning', DONE: 'success', BLOCKED: 'destructive' }
const priorityVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = { LOW: 'secondary', MEDIUM: 'default', HIGH: 'warning', CRITICAL: 'destructive' }
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'] as const
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export function PageClient({ id, initialData }: { id: string; initialData: ProjectDetail }) {
  const qc = useQueryClient()
  const [showTaskForm, setShowTaskForm] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<ProjectDetail>(`/api/projects/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['project-tasks', id],
    queryFn: () => api.get<Task[]>(`/api/projects/${id}/tasks`).then((r) => r.data ?? []),
  })

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema) as unknown as Resolver<TaskInput>,
    defaultValues: { projectId: id, status: 'TODO', priority: 'MEDIUM' },
  })

  const taskMutation = useMutation({
    mutationFn: (data: TaskInput) => api.post(`/api/projects/${id}/tasks`, data),
    onSuccess: () => { toast.success('Task created'); qc.invalidateQueries({ queryKey: ['project-tasks', id] }); setShowTaskForm(false); reset({ projectId: id, status: 'TODO', priority: 'MEDIUM' }) },
    onError: () => toast.error('Failed to create task'),
  })

  return (
    <div className="space-y-6">
      <PageHeader title={project.name} description={`${project.code} · ${project.description ?? ''}`}
        actions={<div className="flex gap-2"><Button onClick={() => setShowTaskForm(true)}><Plus className="mr-2 h-4 w-4" />Add Task</Button><Button variant="outline" asChild><Link href="/projects"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button></div>} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Status</p><div className="mt-1"><Badge variant={statusVariant[project.status] ?? 'secondary'}>{project.status.replace(/_/g, ' ')}</Badge></div></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Progress</p><div className="mt-2 space-y-1"><Progress value={project.progress} className="h-2" /><p className="text-xs text-muted-foreground">{project.progress}% complete</p></div></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Budget</p><p className="mt-1 font-semibold">{formatCurrency(Number(project.budget))}</p><p className="text-xs text-muted-foreground">Spent: {formatCurrency(Number(project.actualCost))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Timeline</p><p className="mt-1 text-sm font-medium">{formatDate(project.startDate)}</p><p className="text-xs text-muted-foreground">{project.endDate ? `to ${formatDate(project.endDate)}` : 'No end date'}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Tasks ({tasks.length})</CardTitle></CardHeader>
        <CardContent>
          {loadingTasks ? <p className="text-sm text-muted-foreground">Loading tasks…</p> : tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks yet. Click &quot;Add Task&quot; to get started.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2 pr-4 font-medium">Title</th><th className="pb-2 pr-4 font-medium w-32">Status</th><th className="pb-2 pr-4 font-medium w-24">Priority</th><th className="pb-2 pr-4 font-medium w-28">Due Date</th><th className="pb-2 font-medium">Assignee</th></tr></thead>
                <tbody className="divide-y">
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2 pr-4"><p className="font-medium">{t.title}</p>{t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}</td>
                      <td className="py-2 pr-4"><Badge variant={taskStatusVariant[t.status] ?? 'secondary'}>{t.status.replace(/_/g, ' ')}</Badge></td>
                      <td className="py-2 pr-4"><Badge variant={priorityVariant[t.priority] ?? 'secondary'}>{t.priority}</Badge></td>
                      <td className="py-2 pr-4">{t.dueDate ? formatDate(t.dueDate) : '—'}</td>
                      <td className="py-2">{t.assignee?.name ?? t.assignee?.email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => taskMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>Title *</Label><Input {...register('title')} />{errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}</div>
              <div className="col-span-2 space-y-1"><Label>Description</Label><Input {...register('description')} /></div>
              <div className="space-y-1"><Label>Status</Label>
                <Select defaultValue="TODO" onValueChange={(v) => setValue('status', v as TaskInput['status'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Priority</Label>
                <Select defaultValue="MEDIUM" onValueChange={(v) => setValue('priority', v as TaskInput['priority'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Start Date</Label><Input {...register('startDate')} type="date" /></div>
              <div className="space-y-1"><Label>Due Date</Label><Input {...register('dueDate')} type="date" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTaskForm(false)}>Cancel</Button>
              <Button type="submit" disabled={taskMutation.isPending}>{taskMutation.isPending ? 'Creating...' : 'Create Task'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
