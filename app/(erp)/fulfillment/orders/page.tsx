import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type FulfillmentOrder = { id: string; fulfillmentNumber: string; customer: { id: string; name: string }; method: string; status: string; priority: string; requestedDate: string; createdAt: string }

export default async function FulfillmentOrdersPage() {
  const initialData = await apiServer<FulfillmentOrder[]>('/api/fulfillment/orders')
  return <PageClient initialData={initialData} />
}
