import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Item = {
  id: string
  sku: string
  barcode: string | null
  barcodeType: string
  secondaryBarcode: string | null
  name: string
  description: string | null
  category: { name: string } | null
  uom: string
  packing: string | null
  reorderPoint: number
  reorderQty: number
  standardCost: number
  sellingPrice: number
  vatRate: number
  expiryDate: string | null
  isActive: boolean
  warehouseStocks: { warehouse: { id: string; name: string }; quantity: number }[]
}

export default async function InventoryItemsPage() {
  const initialData = await apiServer<Item[]>('/api/inventory/items')
  return <PageClient initialData={initialData} />
}
