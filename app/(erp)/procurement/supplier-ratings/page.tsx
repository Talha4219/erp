import { apiServer } from '@/lib/api-server'
import { SupplierRatingsClient } from './_client'

type Rating = {
  id: string; vendorId: string; ratedByName: string; overallScore: number; qualityScore: number
  deliveryScore: number; priceScore: number; notes: string | null; ratedAt: string
  vendor: { name: string; vendorCode: string }
}

export default async function SupplierRatingsPage() {
  const initialData = await apiServer<Rating[]>('/api/procurement/supplier-ratings')
  return <SupplierRatingsClient initialData={initialData} />
}
