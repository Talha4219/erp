'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

type Definition = { id: string; name: string; module: string; isActive: boolean; createdAt: string; steps: { id: string; stepOrder: number; name: string; approverRole: string | null }[]; _count: { instances: number } }

const MODULE_VARIANT: Record<string, 'info'|'warning'|'success'|'secondary'> = { PURCHASE: 'info', SALES: 'warning', HR: 'success', FINANCE: 'secondary' }

export function PageClient({ initialData }: { initialData: Definition[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Definition | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', module: 'PURCHASE', description: '' })
  const [steps, setSteps] = useState<{ name: string; approverRole: string }[]>([])

  const { data, isLoading, error } = useQuery({
    queryKey: ['workflow-definitions'],
    queryFn: () => api.get<Definition[]>('/api/workflow/definitions').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const saveMut = useMutation({
    mutationFn: () => api.post('/api/workflow/definitions', { ...form, steps }),
    onMutate: async () => { await qc.cancelQueries({ queryKey: ['workflow-definitions'] }); const previous = qc.getQueryData(['workflow-definitions']); qc.setQueryData(['workflow-definitions'], (old: any[]) => [{ ...form, id: 'temp-' + Date.now(), isActive: true, createdAt: new Date().toISOString(), steps: steps.map((s, i) => ({ id: 'step-' + i, stepOrder: i, name: s.name, approverRole: s.approverRole })), _count: { instances: 0 } }, ...(old ?? [])]); return { previous } },
    onSuccess: () => { toast.success('Definition created') },
    onError: (err, _vars, context) => { if (context?.previous) qc.setQueryData(['workflow-definitions'], context.previous); toast.error('Failed to save') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['workflow-definitions'] }); setShowForm(false); setEditing(null); setSteps([]) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/workflow/definitions/${id}`),
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: ['workflow-definitions'] }); const previous = qc.getQueryData(['workflow-definitions']); qc.setQueryData(['workflow-definitions'], (old: any[]) => old.filter((d) => d.id !== id)); return { previous } },
    onSuccess: () => { setDeleteId(null); toast.success('Definition deleted') },
    onError: (err, _vars, context) => { if (context?.previous) qc.setQueryData(['workflow-definitions'], context.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['workflow-definitions'] }),
  })

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/api/workflow/definitions/${id}`, { isActive }),
    onMutate: async ({ id, isActive }) => { await qc.cancelQueries({ queryKey: ['workflow-definitions'] }); const previous = qc.getQueryData(['workflow-definitions']); qc.setQueryData(['workflow-definitions'], (old: any[]) => old.map((d) => d.id === id ? { ...d, isActive } : d)); return { previous } },
    onError: (err, _vars, context) => { if (context?.previous) qc.setQueryData(['workflow-definitions'], context.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['workflow-definitions'] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Workflow Definitions" description="Configure approval workflows" actions={<Button onClick={() => { setEditing(null); setSteps([]); setForm({ name: '', module: 'PURCHASE', description: '' }); setShowForm(true) }}><Plus className="mr-2 h-4 w-4" />New Definition</Button>} />
      <DataTable
        columns={[
          { key: 'name', header: 'Name', sortable: true },
          { key: 'module', header: 'Module', render: (r: Definition) => <Badge variant={MODULE_VARIANT[r.module] ?? 'secondary'}>{r.module}</Badge> },
          { key: 'steps', header: 'Steps', render: (r: Definition) => r.steps.length },
          { key: 'instances', header: 'Instances', render: (r: Definition) => r._count.instances },
          { key: 'isActive', header: 'Active', render: (r: Definition) => <Badge variant={r.isActive ? 'success' : 'secondary'} className="cursor-pointer" onClick={() => toggleActiveMut.mutate({ id: r.id, isActive: !r.isActive })}>{r.isActive ? 'Yes' : 'No'}</Badge> },
          { key: 'createdAt', header: 'Created', render: (r: Definition) => formatDate(r.createdAt) },
        ]}
        data={data ?? []} isLoading={isLoading} error={error}
        actions={(row) => <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>}
      />
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); setSteps([]) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Definition' : 'New Definition'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Module</Label>
                <Select value={form.module} onValueChange={(v) => setForm((p) => ({ ...p, module: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="PURCHASE">Purchase</SelectItem><SelectItem value="SALES">Sales</SelectItem><SelectItem value="HR">HR</SelectItem><SelectItem value="FINANCE">Finance</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Approval Steps</Label>
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                    <Input value={s.name} onChange={(e) => setSteps((prev) => prev.map((st, j) => j === i ? { ...st, name: e.target.value } : st))} placeholder="Step name" className="flex-1" />
                    <Input value={s.approverRole} onChange={(e) => setSteps((prev) => prev.map((st, j) => j === i ? { ...st, approverRole: e.target.value } : st))} placeholder="Role (opt)" className="w-36" />
                    <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setSteps((prev) => [...prev, { name: '', approverRole: '' }])}><Plus className="h-3 w-3 mr-1" />Add Step</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); setSteps([]) }}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name}>{saveMut.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMut.mutate(deleteId)} loading={deleteMut.isPending} title="Delete Definition" description="This workflow definition and all its instances will be removed." />
    </div>
  )
}
