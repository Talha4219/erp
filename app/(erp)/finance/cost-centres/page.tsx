import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type CostCentre = { id: string; code: string; name: string; description?: string; isActive: boolean }

export default async function CostCentresPage() {
  const initialData = await apiServer<CostCentre[]>('/api/finance/cost-centres')
  return <PageClient initialData={initialData} />
}
