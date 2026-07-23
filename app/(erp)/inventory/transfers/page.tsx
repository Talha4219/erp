import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Transfer = {
  id: string
  transferNumber: string
  fromWarehouse: { name: string }
  toWarehouse: { name: string }
  transferDate: string
  status: string
  lineItems: { id: string; item: { name: string; packing: string | null; sku: string }; quantity: number; unitCost: number }[]
}

export default async function TransfersPage() {
  const initialData = await apiServer<Transfer[]>('/api/inventory/transfers')
  return <PageClient initialData={initialData} />
}
