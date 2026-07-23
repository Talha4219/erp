import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Customer = { id: string; customerCode: string; name: string; isActive?: boolean }

export default async function NewSalesOrderPage() {
  const customers = await apiServer<Customer[]>('/api/sales/customers')
  return <PageClient customers={customers} />
}
