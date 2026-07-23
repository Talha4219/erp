import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type SalesOrder = {
  id: string
  soNumber: string
  customer: { id: string; name: string; email: string }
  lineItems: Array<{ id: string; item?: { id: string; name: string; sku: string } | null; description: string; quantity: number; unitPrice: number }>
}
type Warehouse = { id: string; name: string }

export default async function NewFulfillmentOrderPage() {
  const [salesOrders, warehouses] = await Promise.all([
    apiServer<SalesOrder[]>('/api/sales/orders'),
    apiServer<Warehouse[]>('/api/inventory/warehouses'),
  ])
  return <PageClient salesOrders={salesOrders} warehouses={warehouses} />
}
