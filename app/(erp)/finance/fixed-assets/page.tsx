import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type FixedAsset = { id: string; assetCode: string; name: string; accountId: string; account: { id: string; code: string; name: string }; purchaseDate: string; purchaseCost: number; residualValue: number; usefulLifeYears: number; depreciationMethod: string; status: string; accumulatedDepreciation: number; bookValue: number; location?: string; serialNumber?: string }

export default async function FixedAssetsPage() {
  const initialData = await apiServer<FixedAsset[]>('/api/finance/fixed-assets')
  return <PageClient initialData={initialData} />
}
