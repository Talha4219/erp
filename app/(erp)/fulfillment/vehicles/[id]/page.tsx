import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type VehicleDetail = {
  id: string; vehicleNumber: string
  make?: string | null; model?: string | null; type?: string | null
  year?: number | null; capacity?: number | null; capacityUnit: string
  fuelType?: string | null; registrationNo?: string | null
  insuranceExpiry?: string | null; status: string; notes?: string | null; createdAt: string
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<VehicleDetail>(`/api/fulfillment/vehicles/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
