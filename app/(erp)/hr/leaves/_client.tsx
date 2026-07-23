'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Check, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

type Leave = { id: string; employee: { firstName: string; lastName: string; employeeCode: string; department: { name: string } | null }; leaveType: string; startDate: string; endDate: string; totalDays: number; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reason: string | null }

const statusVariant: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = { APPROVED: 'success', REJECTED: 'destructive', PENDING: 'warning' }

export function PageClient({ initialData }: { initialData: Leave[] }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['leaves'],
    queryFn: () => api.get<Leave[]>('/api/hr/leaves').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((r) => {
    if (search) {
      const q = search.toLowerCase()
      const name = `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase()
      if (!name.includes(q) && !r.employee.employeeCode.toLowerCase().includes(q)) return false
    }
    return (!filterStatus || r.status === filterStatus) && (!filterType || r.leaveType === filterType)
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/api/hr/leaves/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['leaves'] })
      const previous = qc.getQueryData(['leaves'])
      qc.setQueryData(['leaves'], (old: any[]) => old.map((item: any) => item.id === id ? { ...item, status } : item))
      return { previous }
    },
    onSuccess: (_, vars) => { toast.success(`Leave ${vars.status.toLowerCase()}`) },
    onError: (err, vars, context) => { if (context?.previous) qc.setQueryData(['leaves'], context.previous); toast.error('Failed to update leave') },
    onSettled: () => qc.invalidateQueries({ queryKey: ['leaves'] }),
  })

  const columns = [
    { key: 'employee', header: 'Employee', render: (r: Leave) => `${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'department', header: 'Department', render: (r: Leave) => r.employee.department?.name ?? '-' },
    { key: 'leaveType', header: 'Type', render: (r: Leave) => r.leaveType.replace('_', ' ') },
    { key: 'startDate', header: 'From', render: (r: Leave) => formatDate(r.startDate) },
    { key: 'endDate', header: 'To', render: (r: Leave) => formatDate(r.endDate) },
    { key: 'totalDays', header: 'Days' },
    { key: 'status', header: 'Status', render: (r: Leave) => <Badge variant={statusVariant[r.status] ?? 'secondary'}>{r.status}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Leave Management" description="Manage employee leave requests" />
      <div className="flex gap-3 flex-wrap mb-2">
        <Input placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            {['ANNUAL','SICK','MATERNITY','PATERNITY','UNPAID','OTHER'].map((t) => (
              <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || filterStatus || filterType) && (
          <button className="text-sm text-muted-foreground underline" onClick={() => { setSearch(''); setFilterStatus(''); setFilterType('') }}>Clear</button>
        )}
      </div>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} error={error}
        actions={(row) => {
          if (row.status !== 'PENDING') return null
          return (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => approveMutation.mutate({ id: row.id, status: 'APPROVED' })}><Check className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => approveMutation.mutate({ id: row.id, status: 'REJECTED' })}><X className="h-4 w-4" /></Button>
            </div>
          )
        }}
      />
    </div>
  )
}
