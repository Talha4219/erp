import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type PriceListDetail = { id: string; code: string; name: string; currency: string; items: Array<{ id: string; description: string; unitPrice: number; minQty: number; discount: number; item: { sku: string; name: string } | null }> }

export default async function PriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<PriceListDetail>(`/api/sales/price-lists/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
