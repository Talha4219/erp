import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Balance = { id: string; year: number; entitled: number; used: number; pending: number; remaining: number; employee: { id: string; firstName: string; lastName: string; employeeCode: string }; leaveType: { id: string; code: string; name: string } }

export default async function LeaveBalancesPage() {
  const year = new Date().getFullYear()
  const initialData = await apiServer<Balance[]>(`/api/hr/leave-balances?year=${year}`)
  return <PageClient initialData={initialData} />
}
