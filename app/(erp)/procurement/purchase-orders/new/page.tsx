import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Vendor = { id: string; vendorCode: string; name: string }

export default async function NewPurchaseOrderPage() {
  const vendors = await apiServer<Vendor[]>('/api/procurement/vendors')
  return <PageClient vendors={vendors} />
}
