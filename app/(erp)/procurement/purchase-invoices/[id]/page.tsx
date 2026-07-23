import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type VIDetail = {
  id: string; invoiceNumber: string; status: string; matchingStatus: string
  invoiceDate: string; dueDate: string; createdAt: string
  subTotal: number; taxAmount: number; shippingCharges: number; discountAmount: number
  totalAmount: number; paidAmount: number; notes: string | null; financeNotes: string | null
  vendor: { name: string; email: string | null; creditLimit: number | null }
  vendorRating: number | null; vendorOutstandingBalance: number
  department: { name: string } | null; costCentre: { name: string } | null
  po: {
    poNumber: string; grandTotal: number
    grns: Array<{ id: string; grnNumber: string; lineItems: Array<{ acceptedQty: number; unitPrice: number }> }>
  } | null
  items: Array<{
    id: string; description: string; quantity: number; unitPrice: number; taxRate: number; discount: number; totalPrice: number
    item: { name: string; sku: string } | null; glAccount: { code: string; name: string } | null
    warehouse: { name: string } | null; costCentre: { name: string } | null; project: { name: string } | null
  }>
  payments: Array<{ id: string; amount: number; paymentDate: string; paymentMethod: string; reference: string | null }>
  journalEntries: Array<{
    id: string; entryNumber: string; date: string; description: string
    lines: Array<{ id: string; debitAmount: number; creditAmount: number; description: string | null
      debitAccount: { code: string; name: string } | null; creditAccount: { code: string; name: string } | null }>
  }>
}

export default async function VendorInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<VIDetail>(`/api/procurement/vendor-invoices/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
