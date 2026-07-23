import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Partner = { id: string; code: string; name: string; type: 'CUSTOMER' | 'VENDOR'; email: string | null; phone: string | null; city: string | null; country: string | null; creditLimit: string | null; isActive: boolean; createdAt: string; transactionCount: number }

export default async function BusinessPartnersPage() {
  const initialData = await apiServer<Partner[]>('/api/business-partners')
  return <PageClient initialData={initialData} />
}
