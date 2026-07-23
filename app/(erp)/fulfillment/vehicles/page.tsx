import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Vehicle = { id: string; vehicleNumber: string; registrationNo?: string | null; type?: string | null; status: string; capacity?: number | null }

export default async function VehiclesPage() {
  const initialData = await apiServer<Vehicle[]>('/api/fulfillment/vehicles')
  return <PageClient initialData={initialData} />
}
