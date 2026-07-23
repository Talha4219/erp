import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type RFQDetail = {
  id: string; rfqNumber: string; status: string; rfqDate: string; dueDate: string; notes: string | null
  vendor: { name: string; email: string | null }
  pr: { id: string; prNumber: string } | null
  lineItems: Array<{ id: string; description: string; quantity: number; uom: string }>
  quotations: Array<{
    id: string; sqNumber: string; status: string; totalAmount: number; validUntil: string
    vendor: { id: string; name: string }
  }>
}

export default async function RFQDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<RFQDetail>(`/api/procurement/rfqs/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
