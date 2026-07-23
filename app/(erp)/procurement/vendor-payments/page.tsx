import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Payment = { id: string; amount: number; paymentDate: string; paymentMethod: string; reference: string | null; vendorInvoice: { invoiceNumber: string; vendor: { name: string } } }
type VInvoice = { id: string; invoiceNumber: string; totalAmount: number; paidAmount: number; vendor: { name: string } }

export default async function VendorPaymentsPage() {
  const [payments, invoices] = await Promise.all([
    apiServer<Payment[]>('/api/procurement/vendor-payments'),
    apiServer<VInvoice[]>('/api/procurement/vendor-invoices'),
  ])
  return <PageClient initialPayments={payments} initialInvoices={invoices} />
}
