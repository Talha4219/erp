import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type VI = {
  id: string; invoiceNumber: string; status: string; matchingStatus: string
  invoiceDate: string; dueDate: string; totalAmount: number; paidAmount: number
  vendor: { name: string }; po: { poNumber: string } | null
  department: { name: string } | null
}

export default async function PurchaseInvoicesPage() {
  const initialData = await apiServer<VI[]>('/api/procurement/vendor-invoices')
  return <PageClient initialData={initialData} />
}
