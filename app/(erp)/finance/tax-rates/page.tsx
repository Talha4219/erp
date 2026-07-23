import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type TaxRate = { id: string; code: string; name: string; taxType: string; rate: number; isDefault: boolean; isActive: boolean }

export default async function TaxRatesPage() {
  const initialData = await apiServer<TaxRate[]>('/api/finance/tax-rates')
  return <PageClient initialData={initialData} />
}
