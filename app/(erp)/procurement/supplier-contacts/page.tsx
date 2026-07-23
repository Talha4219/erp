import { apiServer } from '@/lib/api-server'
import { SupplierContactsClient } from './_client'

type Contact = {
  id: string; firstName: string; lastName: string; jobTitle: string | null; department: string | null
  email: string | null; phone: string | null; mobile: string | null; isPrimary: boolean
  vendor: { id: string; name: string; vendorCode: string }
}

export default async function SupplierContactsPage() {
  const initialData = await apiServer<Contact[]>('/api/procurement/supplier-contacts')
  return <SupplierContactsClient initialData={initialData} />
}
