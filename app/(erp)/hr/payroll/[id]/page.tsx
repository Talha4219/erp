import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Payroll = {
  id: string; month: number; year: number; basicSalary: number; allowances: number; overtime: number; grossSalary: number
  payeDeduction: number; niEmployee: number; niEmployer: number; pensionEmployee: number; pensionEmployer: number
  taxDeduction: number; socialSecurity: number; otherDeductions: number; totalDeductions: number; netSalary: number
  isPaid: boolean; paidAt: string | null; notes: string | null; items: Array<{ id: string; amount: number; component: { id: string; name: string; type: 'EARNING' | 'DEDUCTION' } }>
  employee: { id: string; firstName: string; lastName: string; employeeCode: string; email: string; phone: string | null; address: string | null; bankAccount: string | null; bankName: string | null; niNumber: string | null; payrollId: string | null; department: { name: string } | null; designation: { name: string } | null }
}

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<Payroll>(`/api/hr/payroll/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
