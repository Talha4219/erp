import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type SQDetail = {
  id: string; sqNumber: string; status: string; quotationDate: string
  validUntil: string; totalAmount: number; currency: string; notes: string | null
  vendor: { id: string; name: string; email: string | null }
  rfq: { rfqNumber: string; lineItems?: Array<{ description: string; quantity: number; uom: string }> } | null
  lineItems: Array<{ id: string; description: string; quantity: number; uom: string; unitPrice: number; taxRate: number; totalPrice: number }>
  purchaseOrder: { id: string; poNumber: string; status: string } | null
}

export default async function SQDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<SQDetail>(`/api/procurement/supplier-quotations/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
