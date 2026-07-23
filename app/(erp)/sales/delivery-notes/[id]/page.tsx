import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type DNDetail = { id: string; dnNumber: string; status: string; deliveryDate: string; carrier: string | null; trackingNumber: string | null; notes: string | null; customer: { name: string; address: string | null; city: string | null; phone: string | null }; so: { soNumber: string; lineItems: Array<{ id: string; description: string; quantity: number; deliveredQty: number }> }; lineItems: Array<{ id: string; description: string; orderedQty: number; deliveredQty: number }> }

export default async function DeliveryNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<DNDetail>(`/api/sales/delivery-notes/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
