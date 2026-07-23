import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type OrderDetail = {
  id: string; fulfillmentNumber: string; soId: string
  salesOrder: { id: string; soNumber: string }
  customer: { id: string; name: string; email: string; phone: string }
  method: string; status: string; priority: string
  warehouse?: { id: string; name: string } | null
  deliveryAddress?: string | null; pickupLocation?: string | null
  requestedDate?: string | null; createdAt: string; notes?: string | null
  lineItems: Array<{ id: string; item?: { id: string; name: string; sku: string } | null; description: string; quantity: number }>
  driver?: { id: string; name: string } | null
  vehicle?: { id: string; vehicleNumber: string } | null
}

export default async function FulfillmentOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<OrderDetail>(`/api/fulfillment/orders/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
