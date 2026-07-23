import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type PRDetail = {
  id: string; prNumber: string; status: string; requiredDate: string
  totalAmount: number; department: string | null; notes: string | null
  priority: string | null; createdAt: string; updatedAt: string
  requestedById: string
  vendor: { name: string } | null
  lineItems: Array<{ id: string; description: string; quantity: number; uom: string; estimatedUnitPrice: number; totalPrice: number }>
  purchaseOrder: { id: string; poNumber: string; status: string } | null
  rfqs: Array<{ id: string; rfqNumber: string; status: string }>
}

export default async function PRDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<PRDetail>(`/api/procurement/purchase-requests/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
