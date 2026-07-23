import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type ReturnDetail = {
  id: string; returnNumber: string; fulfillmentNumber: string; salesOrderNumber: string
  customer: { id: string; name: string; email: string; phone: string }
  status: string; reason: string; notes: string; createdAt: string
  lineItems: Array<{ id: string; product: { name: string; sku: string }; quantity: number; returnQuantity: number }>
  inspection?: { result: string; notes: string; inspectedBy: string; date: string }
}

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<ReturnDetail>(`/api/fulfillment/returns/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
