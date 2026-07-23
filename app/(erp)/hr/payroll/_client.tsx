'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api-client'
import { payrollSchema, type PayrollInput } from '@/lib/validations/hr'
import type { Resolver } from 'react-hook-form'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Eye } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Payroll = { id: string; employee: { firstName: string; lastName: string; employeeCode: string }; month: number; year: number; basicSalary: number; grossSalary: number; totalDeductions: number; netSalary: number; isPaid: boolean }
type Employee = { id: string; firstName: string; lastName: string; employeeCode: string }

export function PageClient({ initialData }: { initialData: Payroll[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get<{ employees: Employee[] }>('/api/hr/employees').then((r) => r.data?.employees ?? []),
    placeholderData: (prev) => prev,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['payroll', selectedMonth, selectedYear],
    queryFn: () => api.get<Payroll[]>('/api/hr/payroll', { month: selectedMonth, year: selectedYear }).then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const { register, handleSubmit, setValue, reset } = useForm<PayrollInput>({
    resolver: zodResolver(payrollSchema) as unknown as Resolver<PayrollInput>,
    defaultValues: { month: selectedMonth, year: selectedYear, basicSalary: 0, allowances: 0, overtime: 0, taxDeduction: 0, socialSecurity: 0, otherDeductions: 0 },
  })

  const mutation = useMutation({
    mutationFn: (data: PayrollInput) => api.post('/api/hr/payroll', data),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['payroll'] }); const previous = qc.getQueryData(['payroll'])
      const employee = employees?.find(e => e.id === newData.employeeId)
      qc.setQueryData(['payroll'], (old: any[]) => [{ ...newData, id: 'temp-' + Date.now(), employee: employee ?? { firstName: '', lastName: '', employeeCode: '' }, grossSalary: 0, totalDeductions: 0, netSalary: 0, isPaid: false }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Payroll record created') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['payroll'], context.previous); toast.error('Failed to create payroll record') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['payroll'] }); setShowForm(false); reset({} as PayrollInput) },
  })

  const totalNetPay = (data ?? []).reduce((s, p) => s + Number(p.netSalary), 0)

  const columns = [
    { key: 'employee', header: 'Employee', render: (r: Payroll) => `${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'month', header: 'Period', render: (r: Payroll) => `${MONTHS[r.month - 1]} ${r.year}` },
    { key: 'basicSalary', header: 'Basic', render: (r: Payroll) => formatCurrency(Number(r.basicSalary)) },
    { key: 'grossSalary', header: 'Gross', render: (r: Payroll) => formatCurrency(Number(r.grossSalary)) },
    { key: 'totalDeductions', header: 'Deductions', render: (r: Payroll) => formatCurrency(Number(r.totalDeductions)) },
    { key: 'netSalary', header: 'Net Pay', render: (r: Payroll) => <span className="font-semibold text-green-700">{formatCurrency(Number(r.netSalary))}</span> },
    { key: 'isPaid', header: 'Status', render: (r: Payroll) => <Badge variant={r.isPaid ? 'success' : 'secondary'}>{r.isPaid ? 'Paid' : 'Pending'}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll" description="Manage employee payroll records" actions={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Create Payroll</Button>} />
      <div className="flex gap-4 flex-wrap">
        <Input placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
        <div className="flex items-center gap-2"><Label>Month:</Label><Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-center gap-2"><Label>Year:</Label><Input type="number" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="w-24" /></div>
        <Card className="ml-auto"><CardContent className="py-3 px-4"><p className="text-sm text-muted-foreground">Total Net Pay</p><p className="text-xl font-bold text-green-700">{formatCurrency(totalNetPay)}</p></CardContent></Card>
      </div>
      <DataTable columns={columns} data={(data ?? []).filter((p) => {
        if (!search) return true; const q = search.toLowerCase()
        return `${p.employee.firstName} ${p.employee.lastName} ${p.employee.employeeCode}`.toLowerCase().includes(q)
      })} isLoading={isLoading} error={error}
        actions={(row: Payroll) => <Link href={`/hr/payroll/${row.id}`}><Button variant="ghost" size="icon" title="View Payslip"><Eye className="h-4 w-4" /></Button></Link>}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Payroll</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1"><Label>Employee</Label><Select onValueChange={(v) => setValue('employeeId', v)}><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger><SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Month</Label><Select defaultValue={String(selectedMonth)} onValueChange={(v) => setValue('month', parseInt(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Year</Label><Input {...register('year', { valueAsNumber: true })} type="number" defaultValue={selectedYear} /></div>
              {[{ name: 'basicSalary', label: 'Basic Salary' }, { name: 'allowances', label: 'Allowances' }, { name: 'overtime', label: 'Overtime' }, { name: 'taxDeduction', label: 'Tax Deduction' }, { name: 'socialSecurity', label: 'Social Security' }, { name: 'otherDeductions', label: 'Other Deductions' }].map(({ name, label }) => (
                <div key={name} className="space-y-1"><Label>{label}</Label><Input {...register(name as keyof PayrollInput, { valueAsNumber: true })} type="number" step="0.01" min="0" /></div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
