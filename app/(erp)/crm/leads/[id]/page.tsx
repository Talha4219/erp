import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type LeadDetail = {
  id: string; firstName: string; lastName: string; email: string | null; phone: string | null
  company: string | null; jobTitle: string | null; source: string; status: string; notes: string | null
  campaign: { name: string } | null
  activities: Array<{ id: string; type: string; subject: string; description: string | null; dueDate: string | null; completedAt: string | null; createdAt: string }>
  opportunity: { id: string; title: string; stage: string } | null
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<LeadDetail>(`/api/crm/leads/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
