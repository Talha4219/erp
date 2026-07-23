import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type FulfillmentOrder = {
  id: string
  fulfillmentNumber: string
  customerId: string
  customer: { id: string; name: string }
  lineItems: Array<{
    id: string
    description: string
    quantity: number
    item?: { id: string; name: string; sku: string } | null
  }>
}

export default async function NewReturnPage() {
  const orders = await apiServer<FulfillmentOrder[]>('/api/fulfillment/orders')
  return <PageClient orders={orders} />
}
