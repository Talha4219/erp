import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type WarehouseRow = { id: string; code: string; name: string; address: string | null; isActive: boolean; _count?: { stocks: number } }

export default async function WarehousesPage() {
  const initialData = await apiServer<WarehouseRow[]>('/api/inventory/warehouses')
  return <PageClient initialData={initialData} />
}
