import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type ProjectDetail = { id: string; code: string; name: string; description: string | null; status: string; startDate: string; endDate: string | null; budget: number; actualCost: number; progress: number }

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<ProjectDetail>(`/api/projects/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
