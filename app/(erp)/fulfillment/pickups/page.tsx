import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type PickupOrder = { id: string; fulfillmentNumber: string; customer: { name: string }; status: string; pickupLocation: string; requestedDate: string }

export default async function PickupsPage() {
  const initialData = await apiServer<PickupOrder[]>('/api/fulfillment/pickups')
  return <PageClient initialData={initialData} />
}
