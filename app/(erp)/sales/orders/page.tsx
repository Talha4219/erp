import { apiServer } from '@/lib/api-server'
import { SalesOrdersClient } from './_client'

type SalesOrder = {
  id: string; orderNumber: string; channel: string; workflowStatus: string
  orderDate: string; totalAmount: number; customer: { name: string } | null
  legacyStandardId: string | null; legacyRetailId: number | null
}

export default async function SalesOrdersPage() {
  const data = await apiServer<SalesOrder[]>('/api/sales/orders')

  return <SalesOrdersClient initialData={data} />
}
