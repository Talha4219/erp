'use client'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FulfillmentStatusBadge } from '@/components/modules/fulfillment/FulfillmentStatusBadge'
import { Truck, ArrowLeft } from 'lucide-react'
import { DetailPageSkeleton } from '@/components/modules/fulfillment/FulfillmentSkeletons'

type VehicleDetail = {
  id: string; vehicleNumber: string
  make?: string | null; model?: string | null; type?: string | null
  year?: number | null; capacity?: number | null; capacityUnit: string
  fuelType?: string | null; registrationNo?: string | null
  insuranceExpiry?: string | null; status: string; notes?: string | null; createdAt: string
}

export function PageClient({ id, initialData }: { id: string; initialData: VehicleDetail }) {
  const router = useRouter()

  const { data: vehicle, isLoading, error } = useQuery({
    queryKey: ['fulfillment-vehicle', id],
    queryFn: () => api.get<VehicleDetail>(`/api/fulfillment/vehicles/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  if (isLoading) return <DetailPageSkeleton />
  if (error || !vehicle) return <EmptyState icon={Truck} title="Vehicle not found" />

  return (
    <div className="space-y-6">
      <PageHeader title={vehicle.vehicleNumber} description={`${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() || vehicle.type || 'Vehicle'}
        icon={Truck} iconColor="text-indigo-600"
        badge={<FulfillmentStatusBadge status={vehicle.status} />}
        actions={<Button variant="outline" size="sm" onClick={() => router.push('/fulfillment/vehicles')}><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Button>} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Vehicle Information</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Name</p><p className="font-medium mt-1">{vehicle.vehicleNumber}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Plate</p><p className="font-medium mt-1">{vehicle.registrationNo ?? '-'}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Type</p><p className="font-medium mt-1">{vehicle.type ?? '-'}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Make</p><p className="font-medium mt-1">{vehicle.make ?? '-'}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Model</p><p className="font-medium mt-1">{vehicle.model ?? '-'}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Year</p><p className="font-medium mt-1">{vehicle.year ?? '-'}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Capacity</p><p className="font-medium mt-1">{vehicle.capacity ? `${vehicle.capacity} ${vehicle.capacityUnit}` : '-'}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fuel Type</p><p className="font-medium mt-1">{vehicle.fuelType ?? '-'}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Insurance Expiry</p><p className="font-medium mt-1">{vehicle.insuranceExpiry ? formatDate(vehicle.insuranceExpiry) : '-'}</p></div>
              </div>
              {vehicle.notes && (<div className="mt-4 pt-4 border-t"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p><p className="mt-1 text-sm">{vehicle.notes}</p></div>)}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Status</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="flex items-center gap-2"><FulfillmentStatusBadge status={vehicle.status} /></div>
              <p className="text-xs text-muted-foreground mt-2">Added {formatDate(vehicle.createdAt)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
