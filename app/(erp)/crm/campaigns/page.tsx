import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Campaign = { id: string; name: string; type: string; status: string; startDate: string | null; endDate: string | null; budget: number | null; _count: { leads: number } }

export default async function CampaignsPage() {
  const initialData = await apiServer<Campaign[]>('/api/crm/campaigns')
  return <PageClient initialData={initialData} />
}
