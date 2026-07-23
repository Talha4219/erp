'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CalendarRange, Lock, CheckCircle2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

type FiscalYear = { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean; isClosed: boolean; closedAt: string | null; createdAt: string; _count: { periods: number } }

export function PageClient({ initialData }: { initialData: FiscalYear[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false })

  const { data: years, isLoading, error } = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: () => api.get<FiscalYear[]>('/api/finance/fiscal-years').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const create = useMutation({
    mutationFn: (d: typeof form) => api.post('/api/finance/fiscal-years', d),
    onSuccess: () => { toast.success('Fiscal year created'); qc.invalidateQueries({ queryKey: ['fiscal-years'] }); setOpen(false); setForm({ name: '', startDate: '', endDate: '', isCurrent: false }) },
    onError: () => toast.error('Failed to create fiscal year'),
  })

  const setCurrentMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/finance/fiscal-years/${id}`, { isCurrent: true }),
    onSuccess: () => { toast.success('Fiscal year set as current'); qc.invalidateQueries({ queryKey: ['fiscal-years'] }) },
    onError: () => toast.error('Failed'),
  })

  const closePeriod = useMutation({
    mutationFn: (id: string) => api.patch(`/api/finance/fiscal-years/${id}`, { isClosed: true }),
    onSuccess: () => { toast.success('Fiscal year closed'); qc.invalidateQueries({ queryKey: ['fiscal-years'] }) },
    onError: () => toast.error('Failed'),
  })

  const columns = [
    {
      key: 'name', header: 'Fiscal Year',
      render: (r: FiscalYear) => (
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{r.name}</span>
        </div>
      ),
    },
    { key: 'startDate', header: 'Start', render: (r: FiscalYear) => formatDate(r.startDate) },
    { key: 'endDate', header: 'End', render: (r: FiscalYear) => formatDate(r.endDate) },
    { key: 'periods', header: 'Periods', render: (r: FiscalYear) => r._count.periods },
    {
      key: 'status', header: 'Status',
      render: (r: FiscalYear) => (
        <div className="flex gap-1">
          {r.isCurrent && <Badge className="bg-green-100 text-green-800">Current</Badge>}
          {r.isClosed && <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" />Closed</Badge>}
          {!r.isCurrent && !r.isClosed && <Badge variant="outline">Inactive</Badge>}
        </div>
      ),
    },
    {
      key: 'actions_col', header: '',
      render: (r: FiscalYear) => !r.isClosed ? (
        <div className="flex gap-1">
          {!r.isCurrent && (
            <Button size="sm" variant="outline" onClick={() => setCurrentMut.mutate(r.id)}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Set Current
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-destructive border-destructive/30"
            onClick={() => { if (confirm(`Close fiscal year "${r.name}"? This cannot be undone.`)) { closePeriod.mutate(r.id) } }}
          >
            <Lock className="h-3.5 w-3.5 mr-1" />Close
          </Button>
        </div>
      ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Fiscal Years" description="Manage accounting periods and fiscal year calendar"
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Fiscal Year</Button>}
      />
      <DataTable columns={columns} data={years ?? []} isLoading={isLoading} error={error} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Fiscal Year</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Name *</label>
              <Input placeholder="e.g. FY 2026-27" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-xs font-medium">Start Date *</label><Input type="date" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div className="space-y-1"><label className="text-xs font-medium">End Date *</label><Input type="date" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isCurrent} onChange={(e) => setForm(f => ({ ...f, isCurrent: e.target.checked }))} />
              Set as current fiscal year
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.name || !form.startDate || !form.endDate || create.isPending} onClick={() => create.mutate(form)}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
