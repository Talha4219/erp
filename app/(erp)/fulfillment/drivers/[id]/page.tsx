import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type DriverDetail = {
  id: string; name: string
  email?: string | null; contactNumber?: string | null
  licenseNumber?: string | null; address?: string | null
  status: string; notes?: string | null; createdAt: string
}

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialData = await apiServer<DriverDetail>(`/api/fulfillment/drivers/${id}`)
  return <PageClient id={id} initialData={initialData} />
}
