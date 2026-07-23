import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type GRNDetail = {
  id: string; grnNumber: string; receivedDate: string
  receivedById: string; notes: string | null
  po: {
    id: string; poNumber: string; grandTotal: number
    vendor: { id: string; name: string; email: string | null; phone: string | null }
    lineItems: Array<{ id: string; description: string; quantity: number; uom: string; unitPrice: number; item?: { name: string; sku: string | null } | null }>
  }
  lineItems: Array<{ id: string; poLineItemId: string; receivedQty: number; acceptedQty: number; rejectedQty: number; unitPrice: number }>
}

export default async function GRNDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<GRNDetail>(`/api/procurement/grns/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
