import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type ExpenseRow = {
  id: string
  expenseDate: string
  description: string
  amountGbp: string
  vatClaimedGbp: string
  status: string
  paymentDueDate: string | null
  category: { id: number; categoryName: string }
  supplier: { id: number; companyName: string } | null
}

export default async function ExpensesPage() {
  const initialData = await apiServer<ExpenseRow[]>('/api/retail/expenses')
  return <PageClient initialData={initialData} />
}
