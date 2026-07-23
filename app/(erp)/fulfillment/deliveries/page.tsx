import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Delivery = { id: string; fulfillmentNumber: string; customer: { name: string }; status: string; driver?: { name: string }; vehicle?: { vehicleNumber: string }; requestedDate: string }

export default async function DeliveriesPage() {
  const initialData = await apiServer<Delivery[]>('/api/fulfillment/deliveries')
  return <PageClient initialData={initialData} />
}
