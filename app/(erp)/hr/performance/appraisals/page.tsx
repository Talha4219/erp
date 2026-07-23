import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Appraisal = { id: string; period: string; year: number; status: 'DRAFT' | 'APPROVED' | 'SUBMITTED' | 'REVIEWED'; overallScore: number | null; employee: { id: string; firstName: string; lastName: string; employeeCode: string; department: { name: string } | null }; reviewer: { id: string; firstName: string; lastName: string } | null; criteria: { id: string }[] }

export default async function AppraisalsPage() {
  const year = new Date().getFullYear()
  const initialData = await apiServer<Appraisal[]>(`/api/hr/performance/appraisals?year=${year}`)
  return <PageClient initialData={initialData} />
}
