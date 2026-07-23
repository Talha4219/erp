'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Printer, ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type PayrollItem = { id: string; amount: number; component: { id: string; name: string; type: 'EARNING' | 'DEDUCTION' } }
type Payroll = {
  id: string; month: number; year: number; basicSalary: number; allowances: number; overtime: number; grossSalary: number
  payeDeduction: number; niEmployee: number; niEmployer: number; pensionEmployee: number; pensionEmployer: number
  taxDeduction: number; socialSecurity: number; otherDeductions: number; totalDeductions: number; netSalary: number
  isPaid: boolean; paidAt: string | null; notes: string | null; items: PayrollItem[]
  employee: { id: string; firstName: string; lastName: string; employeeCode: string; email: string; phone: string | null; address: string | null; bankAccount: string | null; bankName: string | null; niNumber: string | null; payrollId: string | null; department: { name: string } | null; designation: { name: string } | null }
}

function fmt(n: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n) }

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between py-1 text-sm ${bold ? 'font-semibold' : ''}`}><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
}

export function PageClient({ id, initialData }: { id: string; initialData: Payroll }) {
  const qc = useQueryClient()

  const { data: payroll } = useQuery({
    queryKey: ['payroll', id],
    queryFn: () => api.get<Payroll>(`/api/hr/payroll/${id}`).then(r => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const markPaidMutation = useMutation({
    mutationFn: (isPaid: boolean) => api.patch(`/api/hr/payroll/${id}`, { isPaid }),
    onSuccess: (res) => { toast.success('Payroll status updated'); if (res.success && res.data) qc.setQueryData(['payroll', id], res.data); qc.invalidateQueries({ queryKey: ['payroll', id] }) },
    onError: () => toast.error('Failed to update status'),
  })

  const emp = payroll.employee
  const earnings = payroll.items.filter(i => i.component.type === 'EARNING')
  const deductions = payroll.items.filter(i => i.component.type === 'DEDUCTION')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/hr/payroll"><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" />Back to Payroll</Button></Link>
        <div className="flex gap-2">
          {!payroll.isPaid && (
            <Button variant="outline" onClick={() => markPaidMutation.mutate(true)} disabled={markPaidMutation.isPending}>
              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />Mark as Paid
            </Button>
          )}
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print Payslip</Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto bg-white border rounded-lg shadow-sm p-8 print:shadow-none print:border-none print:p-0" id="payslip">
        <div className="flex justify-between items-start mb-6">
          <div><h1 className="text-2xl font-bold text-gray-900">PAYSLIP</h1><p className="text-sm text-muted-foreground mt-1">{MONTHS[payroll.month - 1]} {payroll.year}</p></div>
          <Badge variant={payroll.isPaid ? 'success' : 'secondary'} className="text-sm px-3 py-1">{payroll.isPaid ? 'PAID' : 'PENDING'}</Badge>
        </div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Employee</h3><p className="font-semibold">{emp.firstName} {emp.lastName}</p><p className="text-sm text-muted-foreground">{emp.employeeCode}</p><p className="text-sm text-muted-foreground">{emp.department?.name}</p><p className="text-sm text-muted-foreground">{emp.designation?.name}</p></div>
          <div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Payment Details</h3><p className="text-sm"><span className="text-muted-foreground">Bank:</span> {emp.bankName ?? '-'}</p><p className="text-sm"><span className="text-muted-foreground">Account:</span> {emp.bankAccount ?? '-'}</p><p className="text-sm"><span className="text-muted-foreground">NI Number:</span> {emp.niNumber ?? '-'}</p><p className="text-sm"><span className="text-muted-foreground">Payroll ID:</span> {emp.payrollId ?? '-'}</p>{payroll.isPaid && payroll.paidAt && <p className="text-sm"><span className="text-muted-foreground">Paid On:</span> {new Date(payroll.paidAt).toLocaleDateString('en-GB')}</p>}</div>
        </div>
        <Separator className="mb-4" />
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Earnings</h3>
          <Row label="Basic Salary" value={fmt(Number(payroll.basicSalary))} />
          {Number(payroll.allowances) > 0 && <Row label="Allowances" value={fmt(Number(payroll.allowances))} />}
          {Number(payroll.overtime) > 0 && <Row label="Overtime" value={fmt(Number(payroll.overtime))} />}
          {earnings.map(item => <Row key={item.id} label={item.component.name} value={fmt(Number(item.amount))} />)}
          <Separator className="my-2" />
          <Row label="Gross Salary" value={fmt(Number(payroll.grossSalary))} bold />
        </div>
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Deductions</h3>
          {Number(payroll.payeDeduction) > 0 && <Row label="PAYE Income Tax" value={`-${fmt(Number(payroll.payeDeduction))}`} />}
          {Number(payroll.niEmployee) > 0 && <Row label="National Insurance (Employee)" value={`-${fmt(Number(payroll.niEmployee))}`} />}
          {Number(payroll.pensionEmployee) > 0 && <Row label="Pension (Employee)" value={`-${fmt(Number(payroll.pensionEmployee))}`} />}
          {Number(payroll.otherDeductions) > 0 && <Row label="Other Deductions" value={`-${fmt(Number(payroll.otherDeductions))}`} />}
          {deductions.map(item => <Row key={item.id} label={item.component.name} value={`-${fmt(Number(item.amount))}`} />)}
          <Separator className="my-2" />
          <Row label="Total Deductions" value={`-${fmt(Number(payroll.totalDeductions))}`} bold />
        </div>
        {(Number(payroll.niEmployer) > 0 || Number(payroll.pensionEmployer) > 0) && (
          <div className="mb-4 bg-muted/50 rounded p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Employer Contributions (not deducted)</h3>
            {Number(payroll.niEmployer) > 0 && <Row label="National Insurance (Employer)" value={fmt(Number(payroll.niEmployer))} />}
            {Number(payroll.pensionEmployer) > 0 && <Row label="Pension (Employer)" value={fmt(Number(payroll.pensionEmployer))} />}
          </div>
        )}
        <Separator className="mb-4" />
        <div className="flex justify-between items-center py-2 bg-primary/5 rounded px-3">
          <span className="text-lg font-bold">Net Pay</span>
          <span className="text-2xl font-bold text-green-700">{fmt(Number(payroll.netSalary))}</span>
        </div>
        {payroll.notes && <p className="mt-4 text-sm text-muted-foreground border-t pt-3"><strong>Notes:</strong> {payroll.notes}</p>}
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #payslip, #payslip * { visibility: visible; }
          #payslip { position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  )
}
