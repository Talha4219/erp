import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Vendor = { id: string; vendorCode: string; name: string; contactPerson: string | null; email: string | null; phone: string | null; city: string | null; country: string | null; isActive: boolean }

export default async function VendorsPage() {
  const initialData = await apiServer<Vendor[]>('/api/procurement/vendors')
  return <PageClient initialData={initialData} />
}
