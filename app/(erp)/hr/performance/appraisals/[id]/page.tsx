import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Appraisal = {
  id: string; period: string; year: number; status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'APPROVED'
  overallScore: number | null; selfComments: string | null; reviewerComments: string | null
  submittedAt: string | null; reviewedAt: string | null; approvedAt: string | null
  criteria: Array<{ id?: string; criteria: string; weight: number; selfScore: number | null; reviewerScore: number | null; comments: string }>
  employee: { firstName: string; lastName: string; employeeCode: string; department: { name: string } | null }
  reviewer: { id: string; firstName: string; lastName: string } | null
}

export default async function AppraisalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<Appraisal>(`/api/hr/performance/appraisals/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
