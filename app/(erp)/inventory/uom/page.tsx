import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type UoM = { id: string; code: string; name: string; symbol: string; category: string; isBase: boolean; isActive: boolean; createdAt: string }

export default async function UoMPage() {
  const initialData = await apiServer<UoM[]>('/api/inventory/uom')
  return <PageClient initialData={initialData} />
}
