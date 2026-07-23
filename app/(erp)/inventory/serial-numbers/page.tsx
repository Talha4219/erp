import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Serial = {
  id: string
  serialCode: string
  item: { id: string; name: string; packing: string | null; sku: string }
  warehouse: { id: string; name: string } | null
  status: string
  purchaseDate: string | null
  warrantyExpiry: string | null
  notes: string | null
}

export default async function SerialNumbersPage() {
  const initialData = await apiServer<Serial[]>('/api/inventory/serial-numbers')
  return <PageClient initialData={initialData} />
}
