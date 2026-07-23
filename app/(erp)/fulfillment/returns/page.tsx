import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Return = { id: string; returnNumber: string; fulfillmentNumber: string; customer: { name: string }; status: string; reason: string; createdAt: string }

export default async function FulfillmentReturnsPage() {
  const initialData = await apiServer<Return[]>('/api/fulfillment/returns')
  return <PageClient initialData={initialData} />
}
