import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Payroll = { id: string; employee: { firstName: string; lastName: string; employeeCode: string }; month: number; year: number; basicSalary: number; grossSalary: number; totalDeductions: number; netSalary: number; isPaid: boolean }

export default async function PayrollPage() {
  const month = new Date().getMonth() + 1
  const year = new Date().getFullYear()
  const initialData = await apiServer<Payroll[]>(`/api/hr/payroll?month=${month}&year=${year}`)
  return <PageClient initialData={initialData} />
}
