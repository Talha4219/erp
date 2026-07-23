import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Job = { id: string; title: string; status: string; employmentType: string; openings: number; location: string | null; closingDate: string | null; department: { name: string }; _count: { applications: number } }

export default async function RecruitmentPage() {
  const initialData = await apiServer<Job[]>('/api/recruitment/jobs')
  return <PageClient initialData={initialData} />
}
