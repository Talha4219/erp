import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Invoice = { id: string; invoiceNumber: string; customer: { name: string }; invoiceDate: string; dueDate: string; totalAmount: number; paidAmount: number; status: 'DRAFT' | 'CANCELLED' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' }

export default async function InvoicesPage() {
  const initialData = await apiServer<Invoice[]>('/api/sales/invoices')
  return <PageClient initialData={initialData} />
}
