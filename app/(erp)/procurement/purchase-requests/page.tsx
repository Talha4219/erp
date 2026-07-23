import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type PR = {
  id: string; prNumber: string; status: string; priority: string
  requiredDate: string; totalAmount: number; department: string | null
  notes: string | null; createdAt: string
  vendor: { name: string } | null; _count: { rfqs: number }
}

export default async function PurchaseRequestsPage() {
  const initialData = await apiServer<PR[]>('/api/procurement/purchase-requests')
  return <PageClient initialData={initialData} />
}
