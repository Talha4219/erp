import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type SalesOrderDetail = {
  id: string
  soNumber: string
  status: string
  orderDate: string
  deliveryDate: string | null
  notes: string | null
  subTotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  customer: { id: string; name: string; email: string | null; phone: string | null; creditLimit: number | null }
  lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: number; discount: number; taxRate: number; totalPrice: number; deliveredQty: number }>
  quotation: { id: string; quotationNumber: string } | null
  invoices: Array<{ id: string; invoiceNumber: string; status: string; totalAmount: number }>
  reservations: Array<{ id: string; itemId: string; warehouseId: string; reservedQty: number }>
  requisitions: Array<{ id: string; prNumber: string; status: string }>
}

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<SalesOrderDetail>(`/api/sales/orders/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
