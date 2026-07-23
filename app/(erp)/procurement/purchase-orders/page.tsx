import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type PO = {
  id: string; poNumber: string; status: string
  orderDate: string; deliveryDate: string | null
  grandTotal: number; currency?: string
  vendor: { id: string; name: string; vendorCode: string }
  _count?: { grns: number }
}

export default async function PurchaseOrdersPage() {
  const initialData = await apiServer<PO[]>('/api/procurement/purchase-orders')
  return <PageClient initialData={initialData} />
}
