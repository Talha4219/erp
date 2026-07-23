'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmployeeForm } from '@/components/modules/hr/EmployeeForm'
import { ExcelImport, type ImportResult } from '@/components/shared/ExcelImport'
import { Plus, Pencil, Trash2, X, Upload, User } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import Image from 'next/image'

type Employee = { id: string; employeeCode: string; firstName: string; lastName: string; email: string; phone?: string | null; dateOfBirth?: string | null; gender?: string | null; address?: string | null; departmentId: string; designationId: string; department: { name: string } | null; designation: { name: string } | null; joinDate: string; isActive: boolean; contractType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN'; employeeTypeId?: number | null; employeeType?: { id: number; typeName: string } | null; basicSalary: number; bankAccount?: string | null; bankName?: string | null; profileImage?: string | null }

export function PageClient({ initialData }: { initialData: Employee[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [filterDept, setFilterDept] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Array<{ id: string; name: string }>>('/api/hr/departments').then((r) => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const buildQuery = () => {
    const p = new URLSearchParams()
    if (filterDept) p.set('department', filterDept)
    if (filterStatus) p.set('status', filterStatus)
    if (filterType) p.set('contractType', filterType)
    return p.toString()
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['employees', filterDept, filterType, filterStatus],
    queryFn: () => api.get<{ employees: Employee[] }>(`/api/hr/employees?${buildQuery()}`).then((r) => r.data?.employees ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/hr/employees/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['employees'] })
      const previous = qc.getQueryData(['employees'])
      qc.setQueryData(['employees'], (old: any[]) => old.filter((item: any) => item.id !== id))
      return { previous }
    },
    onSuccess: () => { toast.success('Employee deactivated') },
    onError: (err, id, context) => { if (context?.previous) qc.setQueryData(['employees'], context.previous); toast.error('Failed to deactivate employee') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setDeleteId(null) },
  })

  const columns = [
    { key: 'employeeCode', header: 'Code', sortable: true },
    {
      key: 'firstName', header: 'Name', sortable: true,
      render: (row: Employee) => (
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 shrink-0 rounded-full overflow-hidden bg-muted border border-border">
            {row.profileImage ? (
              <Image src={row.profileImage} alt={`${row.firstName} ${row.lastName}`} fill className="object-cover" sizes="32px" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><User className="h-4 w-4 text-muted-foreground" /></div>
            )}
          </div>
          <span>{row.firstName} {row.lastName}</span>
        </div>
      ),
    },
    { key: 'department', header: 'Department', render: (row: Employee) => row.department?.name ?? '-' },
    { key: 'designation', header: 'Designation', render: (row: Employee) => row.designation?.name ?? '-' },
    { key: 'contractType', header: 'Type', render: (row: Employee) => row.employeeType?.typeName ?? row.contractType.replace('_', ' ') },
    { key: 'isActive', header: 'Status', render: (row: Employee) => <Badge variant={row.isActive ? 'success' : 'destructive'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'joinDate', header: 'Join Date', render: (row: Employee) => formatDate(row.joinDate) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Employees" description="Manage employee records"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)}><Upload className="mr-2 h-4 w-4" />Import Excel</Button>
            <Button onClick={() => { setEditing(null); setShowForm(true) }}><Plus className="mr-2 h-4 w-4" />Add Employee</Button>
          </div>
        }
      />
      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Search name or code…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Departments</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            <SelectItem value="FULL_TIME">Full Time</SelectItem>
            <SelectItem value="PART_TIME">Part Time</SelectItem>
            <SelectItem value="CONTRACT">Contract</SelectItem>
            <SelectItem value="INTERN">Intern</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterDept || filterType || filterStatus) && (
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterDept(''); setFilterType(''); setFilterStatus('') }}>
            <X className="h-4 w-4 mr-1" />Clear
          </Button>
        )}
      </div>
      <DataTable columns={columns} data={(data ?? []).filter((e) => {
        if (!search) return true
        const q = search.toLowerCase()
        return e.firstName.toLowerCase().includes(q) || e.lastName.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q)
      })} isLoading={isLoading} error={error} virtualized
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => { setEditing(row); setShowForm(true) }}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      />
      {showForm && <EmployeeForm open={showForm} onClose={() => setShowForm(false)} employee={editing} />}
      <ExcelImport open={showImport} onClose={() => setShowImport(false)} templateName="Employees"
        templateHeaders={['Employee Code','First Name','Last Name','Email','Phone','Date of Birth','Gender','Address','Department','Designation','Join Date','Contract Type','Basic Salary','Bank Account','Bank Name','NI Number','Payroll ID']}
        sampleRows={[{'Employee Code':'EMP001','First Name':'John','Last Name':'Smith','Email':'john.smith@company.com','Phone':'07700900000','Date of Birth':'1990-01-15','Gender':'Male','Address':'123 High St, London','Department':'Sales','Designation':'Sales Executive','Join Date':'2024-01-01','Contract Type':'FULL_TIME','Basic Salary':'30000','Bank Account':'12345678','Bank Name':'Barclays','NI Number':'AB123456C','Payroll ID':'PAY001'}]}
        onImport={async (rows) => { const res = await api.post<ImportResult>('/api/hr/employees/import', { rows }); return res.data ?? { success: 0, failed: rows.length, errors: ['Unknown error'] } }}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['employees'] })}
      />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Deactivate Employee" description="This will mark the employee as inactive. Are you sure?" />
    </div>
  )
}
