import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Payment = { id: string; amount: number; paymentDate: string; method: string; reference: string | null; invoice: { invoiceNumber: string; customer: { name: string } } }

export default async function PaymentsPage() {
  const initialData = await apiServer<Payment[]>('/api/sales/payments')
  return <PageClient initialData={initialData} />
}
