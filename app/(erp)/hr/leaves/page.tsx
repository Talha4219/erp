import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Leave = { id: string; employee: { firstName: string; lastName: string; employeeCode: string; department: { name: string } | null }; leaveType: string; startDate: string; endDate: string; totalDays: number; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reason: string | null }

export default async function LeavesPage() {
  const initialData = await apiServer<Leave[]>('/api/hr/leaves')
  return <PageClient initialData={initialData} />
}
