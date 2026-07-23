import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Driver = { id: string; name: string; email: string; phone: string; status: string; licenseNumber: string; activeDeliveries: number }

export default async function DriversPage() {
  const initialData = await apiServer<Driver[]>('/api/fulfillment/drivers')
  return <PageClient initialData={initialData} />
}
