import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type DeliveryDetail = {
  id: string; fulfillmentNumber: string
  salesOrder?: { id: string; soNumber: string } | null
  customer: { id: string; name: string; email: string; phone: string }
  status: string; method: string; deliveryAddress: string
  requestedDate: string; createdAt: string; notes: string
  driver?: { id: string; name: string; email: string; contactNumber: string }
  vehicle?: { id: string; vehicleNumber: string }
  lineItems: Array<{ id: string; item?: { name: string; sku: string } | null; description?: string | null; quantity: number }>
}

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<DeliveryDetail>(`/api/fulfillment/orders/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
