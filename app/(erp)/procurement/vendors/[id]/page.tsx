import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type VendorDetail = {
  id: string; vendorCode: string; name: string; contactPerson: string | null; email: string | null; phone: string | null
  address: string | null; city: string | null; country: string | null; taxId: string | null; paymentTerms: number; creditLimit: number | null; isActive: boolean
  contacts: Array<{ id: string; firstName: string; lastName: string; jobTitle: string | null; department: string | null; email: string | null; phone: string | null; mobile: string | null; isPrimary: boolean; notes: string | null }>
  ratings: Array<{ id: string; ratedByName: string; overallScore: number; qualityScore: number; deliveryScore: number; priceScore: number; notes: string | null; ratedAt: string }>
  purchaseOrders: Array<{ id: string; poNumber: string; status: string; grandTotal: number; orderDate: string; deliveryDate: string | null }>
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<VendorDetail>(`/api/procurement/vendors/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
