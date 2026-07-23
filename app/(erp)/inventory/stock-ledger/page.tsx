import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type LedgerEntry = {
  id: string
  item: { name: string; packing: string | null; sku: string }
  warehouse: { name: string }
  transactionType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
  quantity: number
  unitCost: number
  totalCost: number
  transactionDate: string
  notes: string | null
}

export default async function StockLedgerPage() {
  const initialData = await apiServer<LedgerEntry[]>('/api/inventory/stock')
  return <PageClient initialData={initialData} />
}
