import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Customer = { id: string; customerCode: string; name: string }

export default async function NewInvoicePage() {
  const customers = await apiServer<Customer[]>('/api/sales/customers')
  return <PageClient customers={customers} />
}
