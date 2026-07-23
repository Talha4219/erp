import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type PickupDetail = {
  id: string; fulfillmentNumber: string; salesOrderNumber: string
  customer: { id: string; name: string; email: string; phone: string }
  status: string; method: string; pickupLocation: string
  requestedDate: string; createdAt: string
  lineItems: Array<{ id: string; item: { name: string; sku: string } | null; description?: string | null; quantity: number }>
}

export default async function PickupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<PickupDetail>(`/api/fulfillment/orders/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
