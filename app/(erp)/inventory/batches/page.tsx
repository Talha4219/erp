import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Batch = {
  id: number
  batchNumber: string
  manufacturingDate: string | null
  expiryDate: string | null
  quantityOnHand: number
  receivedDate: string
  item: { id: string; sku: string; name: string; packing?: string | null; uom: string; reorderPoint: number } | null
}

export default async function BatchesPage() {
  const initialData = await apiServer<Batch[]>('/api/inventory/batches')
  return <PageClient initialData={initialData} />
}
