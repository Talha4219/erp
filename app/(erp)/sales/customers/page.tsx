import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Customer = { id: string; customerCode: string; name: string; contactPerson: string | null; email: string | null; phone: string | null; city: string | null; country: string | null; isActive: boolean }

export default async function CustomersPage() {
  const initialData = await apiServer<Customer[]>('/api/sales/customers')
  return <PageClient initialData={initialData} />
}
