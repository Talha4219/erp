import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type LeaveType = {
  id: string
  code: string
  name: string
  daysPerYear: number
  isPaid: boolean
  carryForward: boolean
  maxCarryDays: number
  description: string | null
  isActive: boolean
}

export default async function LeaveTypesPage() {
  const initialData = await apiServer<LeaveType[]>('/api/hr/leave-types')
  return <PageClient initialData={initialData} />
}
