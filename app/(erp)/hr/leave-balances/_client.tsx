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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Pencil, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type Balance = { id: string; year: number; entitled: number; used: number; pending: number; remaining: number; employee: { id: string; firstName: string; lastName: string; employeeCode: string }; leaveType: { id: string; code: string; name: string } }
type Employee = { id: string; firstName: string; lastName: string; employeeCode: string }

export function PageClient({ initialData }: { initialData: Balance[] }) {
  const qc = useQueryClient()
  const [year, setYear] = useState(new Date().getFullYear())
  const [filterEmployee, setFilterEmployee] = useState('')
  const [editing, setEditing] = useState<Balance | null>(null)
  const [editForm, setEditForm] = useState({ entitled: 0, used: 0, pending: 0 })
  const [initLoading, setInitLoading] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['leave-balances', year, filterEmployee],
    queryFn: () => {
      const p = new URLSearchParams({ year: String(year) })
      if (filterEmployee) p.set('employeeId', filterEmployee)
      return api.get<Balance[]>(`/api/hr/leave-balances?${p}`).then(r => r.data ?? [])
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

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => api.get<{ id: string; code: string; name: string }[]>('/api/hr/leave-types').then(r => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) => api.put(`/api/hr/leave-balances/${id}`, data),
    onSuccess: () => { toast.success('Balance updated'); qc.invalidateQueries({ queryKey: ['leave-balances'] }); setEditing(null) },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleInit = async () => {
    setInitLoading(true)
    try {
      const res = await api.post<{ created: number }>('/api/hr/leave-balances', { bulk: true, year })
      toast.success(`Initialised ${res.data?.created ?? 0} balance records for ${year}`)
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
    } catch { toast.error('Failed to initialise balances') }
    finally { setInitLoading(false) }
  }

  const openEdit = (b: Balance) => { setEditing(b); setEditForm({ entitled: Number(b.entitled), used: Number(b.used), pending: Number(b.pending) }) }

  const totals = { entitled: (data ?? []).reduce((s, b) => s + Number(b.entitled), 0), used: (data ?? []).reduce((s, b) => s + Number(b.used), 0), remaining: (data ?? []).reduce((s, b) => s + Number(b.remaining), 0) }

  const columns = [
    { key: 'employee', header: 'Employee', render: (r: Balance) => `${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'code', header: 'Employee Code', render: (r: Balance) => r.employee.employeeCode },
    { key: 'leaveType', header: 'Leave Type', render: (r: Balance) => r.leaveType.name },
    { key: 'entitled', header: 'Entitled', render: (r: Balance) => `${Number(r.entitled)} days` },
    { key: 'used', header: 'Used', render: (r: Balance) => <span className="text-red-600">{Number(r.used)} days</span> },
    { key: 'pending', header: 'Pending', render: (r: Balance) => <span className="text-amber-600">{Number(r.pending)} days</span> },
    { key: 'remaining', header: 'Remaining', render: (r: Balance) => { const rem = Number(r.remaining); return <span className={rem <= 2 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>{rem} days</span> } },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Leave Balances" description="Track employee leave entitlements and usage by year"
        actions={<Button variant="outline" onClick={handleInit} disabled={initLoading}><RefreshCw className={`mr-2 h-4 w-4 ${initLoading ? 'animate-spin' : ''}`} />{initLoading ? 'Initialising…' : `Initialise ${year} Balances`}</Button>}
      />
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-2"><Label>Year</Label><Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-24" /></div>
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Employees</SelectItem>
            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Entitled</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totals.entitled} days</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Used</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{totals.used} days</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Remaining</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{totals.remaining} days</p></CardContent></Card>
      </div>
      {leaveTypes.length === 0 && (
        <p className="text-sm text-muted-foreground">No leave types configured yet. Go to <strong>Leave Types</strong> to set them up, then click &quot;Initialise Balances&quot;.</p>
      )}
      <DataTable columns={columns} data={data ?? []} isLoading={isLoading} error={error}
        actions={(row) => <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>}
      />
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Balance — {editing?.employee.firstName} {editing?.employee.lastName} / {editing?.leaveType.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[{ label: 'Entitled Days', key: 'entitled' }, { label: 'Used Days', key: 'used' }, { label: 'Pending Days', key: 'pending' }].map(({ label, key }) => (
              <div key={key} className="space-y-1"><Label>{label}</Label><Input type="number" min={0} step={0.5} value={editForm[key as keyof typeof editForm]} onChange={e => setEditForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))} /></div>
            ))}
            <p className="text-sm text-muted-foreground">Remaining = Entitled − Used − Pending = <strong>{editForm.entitled - editForm.used - editForm.pending} days</strong></p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={updateMutation.isPending} onClick={() => editing && updateMutation.mutate({ id: editing.id, data: editForm })}>{updateMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
