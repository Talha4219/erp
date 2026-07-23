import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type CourierOrder = { id: string; fulfillmentNumber: string; customer: { name: string }; status: string; createdAt: string; courierShipments?: Array<{ courierName: string; trackingNumber: string | null; charges: number }> }

export default async function CourierPage() {
  const initialData = await apiServer<CourierOrder[]>('/api/fulfillment/courier')
  return <PageClient initialData={initialData} />
}
