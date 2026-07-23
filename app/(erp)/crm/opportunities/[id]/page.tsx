import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type OppDetail = { id: string; title: string; stage: string; probability: number; value: number; expectedClose: string | null; notes: string | null; assignedTo: string | null; lead: { id: string; firstName: string; lastName: string } | null; contact: { id: string; firstName: string; lastName: string } | null; customer: { id: string; name: string } | null; activities: Array<{ id: string; type: string; subject: string; description: string | null; dueDate: string | null; completedAt: string | null; createdAt: string }> }

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<OppDetail>(`/api/crm/opportunities/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
