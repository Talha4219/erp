import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Contact = { id: string; firstName: string; lastName: string; jobTitle: string | null; department: string | null; email: string | null; phone: string | null }
type Quotation = { id: string; quotationNumber: string; quotationDate: string; totalAmount: number; status: string }
type Order = { id: string; soNumber: string; orderDate: string; totalAmount: number; status: string }
type Payment = { id: string; amount: number; paymentDate: string; method: string; reference: string | null; invoiceNumber: string }
type Invoice = { id: string; invoiceNumber: string; invoiceDate: string; dueDate: string; totalAmount: number; paidAmount: number; status: string; payments: Payment[] }
type ReturnRow = { id: string; returnNumber: string; returnDate: string; reason: string; status: string; totalAmount: number }
type Rating = { id: string; ratedByName: string; overallScore: number; paymentScore: number; businessScore: number; relationshipScore: number; notes: string | null; ratedAt: string }
type Opportunity = { id: string; title: string; stage: string; createdAt: string; lead: { firstName: string; lastName: string; createdAt: string } | null }
type Document = { id: string; title: string; category: string; fileName: string; createdAt: string }

type CustomerDetail = {
  id: string; customerCode: string; name: string; contactPerson: string | null; email: string | null; phone: string | null
  address: string | null; city: string | null; country: string | null; taxId: string | null
  creditLimit: number | null; paymentTerms: number; isActive: boolean
  contacts: Contact[]; quotations: Quotation[]; salesOrders: Order[]; invoices: Invoice[]
  returns: ReturnRow[]; ratings: Rating[]; opportunities: Opportunity[]; documents: Document[]
  totalRevenue: number; outstandingAmount: number; openOrders: number; lastPurchase: string | null
  paymentHistory: Payment[]
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<CustomerDetail>(`/api/sales/customers/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
