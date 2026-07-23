import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type ReturnDetail = { id: string; returnNumber: string; status: string; returnDate: string; reason: string; notes: string | null; totalAmount: number; customer: { name: string; email: string | null }; invoice: { invoiceNumber: string }; lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: number; totalPrice: number }>; creditNote: { id: string; creditNoteNumber: string; status: string; amount: number } | null }

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<ReturnDetail>(`/api/sales/returns/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
