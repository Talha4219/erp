import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type QuotationDetail = {
  id: string
  quotationNumber: string
  status: string
  quotationDate: string
  expiryDate: string
  notes: string | null
  subTotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  customer: { id: string; name: string; email: string | null; phone: string | null }
  lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: number; discount: number; taxRate: number; totalPrice: number }>
  salesOrder: { id: string; soNumber: string } | null
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<QuotationDetail>(`/api/sales/quotations/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
