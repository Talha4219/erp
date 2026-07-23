import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Lead = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; company: string | null; jobTitle: string | null; source: string; status: string; rating: number }

export default async function LeadsPage() {
  const initialData = await apiServer<Lead[]>('/api/crm/leads')
  return <PageClient initialData={initialData} />
}
