'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type Component = { id: string; name: string; type: 'EARNING' | 'DEDUCTION'; calcMethod: 'FIXED' | 'PERCENTAGE_OF_BASIC'; value: number; isTaxable: boolean; isStatutory: boolean; isActive: boolean }

const empty = (): Omit<Component, 'id'> => ({ name: '', type: 'EARNING', calcMethod: 'FIXED', value: 0, isTaxable: true, isStatutory: false, isActive: true })

export function PageClient({ initialData }: { initialData: Component[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Component | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(empty())

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['salary-components'],
    queryFn: () => api.get<Component[]>('/api/hr/salary-components').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const saveMut = useMutation({
    mutationFn: (payload: Omit<Component, 'id'> & { id?: string }) => payload.id ? api.put(`/api/hr/salary-components/${payload.id}`, payload) : api.post('/api/hr/salary-components', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-components'] }); toast.success(editing ? 'Component updated' : 'Component created'); handleClose() },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/hr/salary-components/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-components'] }); toast.success('Component deleted'); setDeleteId(null) },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleClose() { setShowForm(false); setEditing(null); setForm(empty()) }
  function openEdit(c: Component) { setEditing(c); setForm({ name: c.name, type: c.type, calcMethod: c.calcMethod, value: c.value, isTaxable: c.isTaxable, isStatutory: c.isStatutory, isActive: c.isActive }); setShowForm(true) }
  function submit(e: React.FormEvent) { e.preventDefault(); saveMut.mutate(editing ? { ...form, id: editing.id } : form) }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type', render: (row: Component) => <Badge variant={row.type === 'EARNING' ? 'default' : 'destructive'} className="text-xs">{row.type}</Badge> },
    { key: 'calcMethod', label: 'Method', render: (row: Component) => <span className="text-sm">{row.calcMethod === 'FIXED' ? 'Fixed £' : '% of Basic'}</span> },
    { key: 'value', label: 'Value', render: (row: Component) => <span>{row.calcMethod === 'FIXED' ? `£${Number(row.value).toFixed(2)}` : `${row.value}%`}</span> },
    { key: 'isTaxable', label: 'Taxable', render: (row: Component) => <Badge variant={row.isTaxable ? 'secondary' : 'outline'}>{row.isTaxable ? 'Yes' : 'No'}</Badge> },
    { key: 'isStatutory', label: 'Statutory', render: (row: Component) => <Badge variant={row.isStatutory ? 'secondary' : 'outline'}>{row.isStatutory ? 'Yes' : 'No'}</Badge> },
    { key: 'isActive', label: 'Status', render: (row: Component) => <Badge variant={row.isActive ? 'default' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', render: (row: Component) => (
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    )},
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Salary Components" description="Manage earnings and deduction components used in payroll" actions={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Add Component</Button>} />
      <DataTable columns={columns} data={data} loading={isLoading} error={error} />
      <Dialog open={showForm} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Component' : 'New Salary Component'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as 'EARNING' | 'DEDUCTION' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="EARNING">Earning</SelectItem><SelectItem value="DEDUCTION">Deduction</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Calculation</Label>
                <Select value={form.calcMethod} onValueChange={(v) => setForm((f) => ({ ...f, calcMethod: v as 'FIXED' | 'PERCENTAGE_OF_BASIC' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="FIXED">Fixed Amount (£)</SelectItem><SelectItem value="PERCENTAGE_OF_BASIC">% of Basic Salary</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>{form.calcMethod === 'FIXED' ? 'Amount (£)' : 'Percentage (%)'}</Label>
              <Input type="number" step="0.01" min="0" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: parseFloat(e.target.value) || 0 }))} required /></div>
            <div className="grid grid-cols-3 gap-4">
              {(['isTaxable', 'isStatutory', 'isActive'] as const).map((field) => (
                <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.checked }))} className="rounded" />
                  {field === 'isTaxable' ? 'Taxable' : field === 'isStatutory' ? 'Statutory' : 'Active'}
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Component" description="This will remove the salary component. Existing payroll records are not affected." onConfirm={() => deleteId && deleteMut.mutate(deleteId)} loading={deleteMut.isPending} />
    </div>
  )
}
