import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type PriceList = { id: string; code: string; name: string; currency: string; isDefault: boolean; isActive: boolean; startDate: string | null; endDate: string | null; _count: { items: number } }

export default async function PriceListsPage() {
  const initialData = await apiServer<PriceList[]>('/api/sales/price-lists')
  return <PageClient initialData={initialData} />
}
