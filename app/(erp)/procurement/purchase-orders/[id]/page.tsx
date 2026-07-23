import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type LineItem = {
  id: string; description: string; quantity: number; uom: string
  unitPrice: number; taxRate: number; totalPrice: number
  item?: { name: string; sku: string | null } | null
}
type PODetail = {
  id: string; poNumber: string; status: string
  orderDate: string; deliveryDate: string | null
  terms: string | null; notes: string | null; currency?: string
  totalAmount: number; taxAmount: number; shippingCost: number; grandTotal: number
  vendor: { id: string; name: string; vendorCode: string; email: string | null; phone: string | null }
  pr: { id: string; prNumber: string } | null
  lineItems: LineItem[]
  _count: { grns: number; vendorInvoices: number }
}

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<PODetail>(`/api/procurement/purchase-orders/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
