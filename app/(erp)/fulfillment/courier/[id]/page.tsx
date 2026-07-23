import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type CourierDetail = {
  id: string; fulfillmentNumber: string
  salesOrder?: { id: string; soNumber: string } | null
  customer: { id: string; name: string; email: string; phone: string }
  status: string; method: string
  deliveryAddress?: string | null
  requestedDate: string; createdAt: string
  lineItems: Array<{ id: string; item?: { name: string; sku: string } | null; description?: string | null; quantity: number }>
}

export default async function CourierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<CourierDetail>(`/api/fulfillment/orders/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
