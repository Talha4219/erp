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
import { User, ArrowLeft, Truck, Mail, Phone, IdCard } from 'lucide-react'
import Link from 'next/link'
import { DetailPageSkeleton } from '@/components/modules/fulfillment/FulfillmentSkeletons'

type DriverDetail = {
  id: string; name: string
  email?: string | null; contactNumber?: string | null
  licenseNumber?: string | null; address?: string | null
  status: string; notes?: string | null; createdAt: string
}

export function PageClient({ id, initialData }: { id: string; initialData: DriverDetail }) {
  const router = useRouter()

  const { data: driver, isLoading, error } = useQuery({
    queryKey: ['fulfillment-driver', id],
    queryFn: () => api.get<DriverDetail>(`/api/fulfillment/drivers/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  if (isLoading) return <DetailPageSkeleton />
  if (error || !driver) return <EmptyState icon={User} title="Driver not found" />

  return (
    <div className="space-y-6">
      <PageHeader title={driver.name} description="Driver profile" icon={User} iconColor="text-indigo-600"
        badge={<FulfillmentStatusBadge status={driver.status} />}
        actions={<Button variant="outline" size="sm" onClick={() => router.push('/fulfillment/drivers')}><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Button>} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{driver.email ?? '-'}</span></div>
                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{driver.contactNumber ?? '-'}</span></div>
                <div className="flex items-center gap-3"><IdCard className="h-4 w-4 text-muted-foreground" /><span className="text-sm">License: {driver.licenseNumber ?? '-'}</span></div>
              </div>
              {driver.notes && (<div className="mt-4"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p><p className="text-sm mt-1 text-muted-foreground">{driver.notes}</p></div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" />Address</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4"><p className="text-sm">{driver.address ?? 'No address on file'}</p></CardContent>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Details</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</p><div className="mt-1"><FulfillmentStatusBadge status={driver.status} /></div></div>
              <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Created</p><p className="text-sm mt-1">{formatDate(driver.createdAt)}</p></div>
            </CardContent>
          </Card>
          <Button variant="outline" className="w-full" asChild><Link href="/fulfillment/drivers">All Drivers</Link></Button>
        </div>
      </div>
    </div>
  )
}
