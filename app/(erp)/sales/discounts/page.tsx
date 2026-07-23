import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Discount = { id: string; code: string; name: string; type: string; value: number; minOrderValue: number | null; maxUsage: number | null; usageCount: number; startDate: string | null; endDate: string | null; isActive: boolean }

export default async function DiscountsPage() {
  const initialData = await apiServer<Discount[]>('/api/sales/discounts')
  return <PageClient initialData={initialData} />
}
