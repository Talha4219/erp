import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Quotation = { id: string; quotationNumber: string; quotationDate: string; expiryDate: string; status: string; totalAmount: number; customer: { name: string } }

export default async function QuotationsPage() {
  const initialData = await apiServer<Quotation[]>('/api/sales/quotations')
  return <PageClient initialData={initialData} />
}
