import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Return = { id: string; returnNumber: string; status: string; returnDate: string; reason: string; totalAmount: number; customer: { name: string }; invoice: { invoiceNumber: string }; creditNote: { creditNoteNumber: string; status: string } | null }

export default async function ReturnsPage() {
  const initialData = await apiServer<Return[]>('/api/sales/returns')
  return <PageClient initialData={initialData} />
}
