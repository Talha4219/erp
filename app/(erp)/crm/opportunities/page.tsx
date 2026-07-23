import { apiServer } from '@/lib/api-server'
import { OpportunitiesClient } from './_client'

type Opp = { id: string; title: string; stage: string; probability: number; value: number; expectedClose: string | null; contact: { firstName: string; lastName: string } | null; customer: { name: string } | null }

export default async function OpportunitiesPage() {
  const initialData = await apiServer<Opp[]>('/api/crm/opportunities')
  return <OpportunitiesClient initialData={initialData} />
}
