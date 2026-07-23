import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type FiscalYear = { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean; isClosed: boolean; closedAt: string | null; createdAt: string; _count: { periods: number } }

export default async function FiscalYearsPage() {
  const initialData = await apiServer<FiscalYear[]>('/api/finance/fiscal-years')
  return <PageClient initialData={initialData} />
}
