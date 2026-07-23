import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type DN = { id: string; dnNumber: string; status: string; deliveryDate: string; carrier: string | null; trackingNumber: string | null; customer: { name: string }; so: { soNumber: string }; _count: { lineItems: number } }

export default async function DeliveryNotesPage() {
  const initialData = await apiServer<DN[]>('/api/sales/delivery-notes')
  return <PageClient initialData={initialData} />
}
