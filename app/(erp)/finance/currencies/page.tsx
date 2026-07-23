import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Currency = { id: string; code: string; name: string; symbol: string; exchangeRate: number; isBase: boolean; isActive: boolean }

export default async function CurrenciesPage() {
  const initialData = await apiServer<Currency[]>('/api/finance/currencies')
  return <PageClient initialData={initialData} />
}
