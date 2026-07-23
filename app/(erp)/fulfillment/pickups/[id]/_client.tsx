'use client'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FulfillmentStatusBadge } from '@/components/modules/fulfillment/FulfillmentStatusBadge'
import { FulfillmentMethodBadge } from '@/components/modules/fulfillment/FulfillmentMethodBadge'
import { toast } from 'sonner'
import { User, ArrowLeft, MapPin, Loader2, CheckCircle2, FileText } from 'lucide-react'
import Link from 'next/link'

type PickupDetail = {
  id: string; fulfillmentNumber: string; salesOrderNumber: string
  customer: { id: string; name: string; email: string; phone: string }
  status: string; method: string; pickupLocation: string
  requestedDate: string; createdAt: string
  lineItems: Array<{ id: string; item: { name: string; sku: string } | null; description?: string | null; quantity: number }>
}

export function PageClient({ id, initialData }: { id: string; initialData: PickupDetail }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: pickup, isLoading, error } = useQuery({
    queryKey: ['fulfillment-pickup', id],
    queryFn: () => api.get<PickupDetail>(`/api/fulfillment/orders/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const deliverMutation = useMutation({
    mutationFn: () => api.post(`/api/fulfillment/orders/${id}/deliver`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fulfillment-pickup', id] }); toast.success('Pickup marked as collected') },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return (<div className="space-y-6"><div className="h-10 w-96 animate-pulse rounded-lg bg-muted" /><div className="h-48 animate-pulse rounded-xl bg-white border border-border/50" /></div>)
  if (error || !pickup) return <EmptyState icon={User} title="Pickup order not found" />

  return (
    <div className="space-y-6">
      <PageHeader title={pickup.fulfillmentNumber} description={`Pickup - ${pickup.customer.name}`} icon={User} iconColor="text-emerald-600"
        badge={<div className="flex items-center gap-2"><FulfillmentStatusBadge status={pickup.status} /><FulfillmentMethodBadge method={pickup.method} /></div>}
        actions={<Button variant="outline" size="sm" onClick={() => router.push('/fulfillment/pickups')}><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Button>} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />Pickup Information</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Customer</p><p className="font-medium mt-1">{pickup.customer.name}</p><p className="text-xs text-muted-foreground">{pickup.customer.email}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sales Order</p><p className="font-medium mt-1">{pickup.salesOrderNumber}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Requested Date</p><p className="font-medium mt-1">{formatDate(pickup.requestedDate)}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Created</p><p className="font-medium mt-1">{formatDate(pickup.createdAt)}</p></div>
              </div>
              {pickup.pickupLocation && (<div className="mt-4 p-3 rounded-lg bg-muted/30"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Pickup Location</p><p className="text-sm">{pickup.pickupLocation}</p></div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />Items</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider"><th className="pb-2 font-medium">Product</th><th className="pb-2 font-medium">SKU</th><th className="pb-2 font-medium text-right">Qty</th></tr></thead>
                <tbody>{pickup.lineItems.map((item) => (<tr key={item.id} className="border-b last:border-0"><td className="py-2 font-medium">{item.item?.name ?? item.description ?? '-'}</td><td className="py-2 text-muted-foreground">{item.item?.sku ?? '-'}</td><td className="py-2 text-right">{item.quantity}</td></tr>))}</tbody>
              </table>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Actions</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4 space-y-2">
              {pickup.status === 'READY' && (
                <Button className="w-full" onClick={() => deliverMutation.mutate()} disabled={deliverMutation.isPending}>
                  {deliverMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<CheckCircle2 className="mr-2 h-4 w-4" />Mark Collected
                </Button>
              )}
              <Button variant="outline" className="w-full" asChild><Link href={`/fulfillment/orders/${pickup.id}`}>View Full Order</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
