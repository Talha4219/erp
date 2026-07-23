'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import { api } from '@/lib/api-client'
import { projectSchema, type ProjectInput } from '@/lib/validations/projects'
import { CrudListPage } from '@/components/shared/CrudListPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Eye } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'

type Project = {
  id: string
  code: string
  name: string
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string | null
  budget: number
  actualCost: number
  progress: number
  _count: { tasks: number }
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  PLANNING: 'secondary',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
}

const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const

function ProjectForm({ editing, onSave, onCancel, isPending }: {
  editing: Project | null
  onSave: (data: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema) as unknown as Resolver<ProjectInput>,
    defaultValues: { status: 'PLANNING', budget: 0 } as Partial<ProjectInput>,
  })

  useEffect(() => {
    if (editing) {
      reset({
        code: editing.code,
        name: editing.name,
        description: '',
        status: editing.status,
        budget: Number(editing.budget),
        startDate: editing.startDate.split('T')[0],
        endDate: editing.endDate ? editing.endDate.split('T')[0] : '',
      })
    } else {
      reset({ status: 'PLANNING', budget: 0 } as Partial<ProjectInput>)
    }
  }, [editing, reset])

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Project Code</Label>
          <Input {...register('code')} />
          {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select defaultValue="PLANNING" onValueChange={(v) => setValue('status', v as ProjectInput['status'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Project Name</Label>
          <Input {...register('name')} />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Description</Label>
          <Input {...register('description')} />
        </div>
        <div className="space-y-1">
          <Label>Budget</Label>
          <Input {...register('budget', { valueAsNumber: true })} type="number" min="0" step="0.01" />
        </div>
        <div className="space-y-1">
          <Label>Start Date</Label>
          <Input {...register('startDate')} type="date" />
          {errors.startDate && <p className="text-xs text-red-500">{errors.startDate.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>End Date</Label>
          <Input {...register('endDate')} type="date" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : editing ? 'Update' : 'Create'}</Button>
      </DialogFooter>
    </form>
  )
}

export function PageClient({ initialData }: { initialData: Project[] }) {
  const columns = [
    { key: 'code', header: 'Code', sortable: true },
    { key: 'name', header: 'Project Name', sortable: true },
    {
      key: 'status',
      header: 'Status',
      render: (r: Project) => <Badge variant={statusVariant[r.status] ?? 'secondary'}>{r.status.replace(/_/g, ' ')}</Badge>,
    },
    { key: 'startDate', header: 'Start', render: (r: Project) => formatDate(r.startDate) },
    { key: 'endDate', header: 'End', render: (r: Project) => r.endDate ? formatDate(r.endDate) : '-' },
    { key: 'budget', header: 'Budget', render: (r: Project) => formatCurrency(Number(r.budget ?? 0)) },
    {
      key: 'progress',
      header: 'Progress',
      render: (r: Project) => (
        <div className="flex items-center gap-2">
          <Progress value={r.progress ?? 0} className="h-2 w-20" />
          <span className="text-xs">{r.progress ?? 0}%</span>
        </div>
      ),
    },
    { key: '_count', header: 'Tasks', render: (r: Project) => r._count.tasks },
  ]

  return (
    <CrudListPage<Project>
      title="Projects"
      description="Manage projects and tasks"
      queryKey={['projects']}
      apiEndpoint="/api/projects"
      initialData={initialData}
      columns={columns}
      searchPlaceholder="Search name or code…"
      searchFields={['name', 'code']}
      filters={[
        {
          key: 'status',
          label: 'Status',
          options: PROJECT_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
        },
      ]}
      onSave={async (data, id) => {
        if (id) return api.put(`/api/projects/${id}`, data)
        return api.post('/api/projects', data)
      }}
      onDelete={async (id) => api.delete(`/api/projects/${id}`)}
      FormComponent={ProjectForm}
      addButtonLabel="New Project"
      actions={(row) => (
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${row.id}`}><Eye className="h-4 w-4" /></Link>
        </Button>
      )}
    />
  )
}
