import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type InvoiceDetail = {
  id: string
  invoiceNumber: string
  status: string
  invoiceDate: string
  dueDate: string
  notes: string | null
  subTotal: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  customer: { id: string; name: string; email: string | null; phone: string | null }
  lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: number; discount: number; taxRate: number; totalPrice: number }>
  payments: Array<{ id: string; amount: number; paymentDate: string; method: string; reference: string | null }>
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<InvoiceDetail>(`/api/sales/invoices/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
