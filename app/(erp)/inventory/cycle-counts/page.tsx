import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type CycleCount = {
  id: string
  countNumber: string
  warehouse: { name: string }
  countDate: string
  status: string
  lineItems: { id: string; item: { name: string; packing: string | null; sku: string; uom: string }; systemQty: number; countedQty: number | null; variance: number | null; notes: string | null }[]
}

export default async function CycleCountsPage() {
  const initialData = await apiServer<CycleCount[]>('/api/inventory/cycle-counts')
  return <PageClient initialData={initialData} />
}
