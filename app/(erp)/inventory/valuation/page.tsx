import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type ValuationRow = {
  warehouseId: string; warehouseName: string; itemId: string; sku: string
  itemName: string; uom: string; quantity: number; avgCost: number
  standardCost: number; unitCost: number; totalValue: number; method: string
}
type ValuationResult = { valuation: ValuationRow[]; totalStockValue: number; method: string }

export default async function ValuationPage() {
  const initialData = await apiServer<ValuationResult>('/api/inventory/valuation?method=moving_average')
  return <PageClient initialData={initialData} />
}
