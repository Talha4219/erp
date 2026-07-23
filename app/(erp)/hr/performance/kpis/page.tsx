import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type EmployeeKpi = { id: string; year: number; quarter: number | null; target: number; actual: number | null; score: number | null; notes: string | null; employee: { id: string; firstName: string; lastName: string; employeeCode: string }; kpi: { id: string; name: string; category: string | null; targetType: string; unit: string | null } }

export default async function KpisPage() {
  const year = new Date().getFullYear()
  const initialData = await apiServer<EmployeeKpi[]>(`/api/hr/performance/kpis?year=${year}`)
  return <PageClient initialData={initialData} />
}
