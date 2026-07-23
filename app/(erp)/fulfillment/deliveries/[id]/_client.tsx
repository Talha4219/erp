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
import { Truck, ArrowLeft, MapPin, User, Loader2, CheckCircle2, FileText } from 'lucide-react'
import Link from 'next/link'

type DeliveryDetail = {
  id: string; fulfillmentNumber: string
  salesOrder?: { id: string; soNumber: string } | null
  customer: { id: string; name: string; email: string; phone: string }
  status: string; method: string; deliveryAddress: string
  requestedDate: string; createdAt: string; notes: string
  driver?: { id: string; name: string; email: string; contactNumber: string }
  vehicle?: { id: string; vehicleNumber: string }
  lineItems: Array<{ id: string; item?: { name: string; sku: string } | null; description?: string | null; quantity: number }>
  shipments?: Array<{ id: string; shipmentNumber: string; status: string; dispatchedAt?: string | null; deliveredAt?: string | null }>
}

export function PageClient({ id, initialData }: { id: string; initialData: DeliveryDetail }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: delivery, isLoading, error } = useQuery({
    queryKey: ['fulfillment-delivery', id],
    queryFn: () => api.get<DeliveryDetail>(`/api/fulfillment/orders/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const deliverMutation = useMutation({
    mutationFn: () => api.post(`/api/fulfillment/orders/${id}/deliver`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fulfillment-delivery', id] }); toast.success('Delivery marked as delivered') },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return (<div className="space-y-6"><div className="h-10 w-96 animate-pulse rounded-lg bg-muted" /><div className="h-48 animate-pulse rounded-xl bg-white border border-border/50" /></div>)
  if (error || !delivery) return <EmptyState icon={Truck} title="Delivery not found" />

  return (
    <div className="space-y-6">
      <PageHeader title={delivery.fulfillmentNumber} description={`Delivery - ${delivery.customer.name}`} icon={Truck} iconColor="text-indigo-600"
        badge={<div className="flex items-center gap-2"><FulfillmentStatusBadge status={delivery.status} /><FulfillmentMethodBadge method={delivery.method} /></div>}
        actions={<Button variant="outline" size="sm" onClick={() => router.push('/fulfillment/deliveries')}><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Button>} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />Delivery Information</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Customer</p><p className="font-medium mt-1">{delivery.customer.name}</p><p className="text-xs text-muted-foreground">{delivery.customer.email}</p>{delivery.customer.phone && <p className="text-xs text-muted-foreground">{delivery.customer.phone}</p>}</div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sales Order</p><p className="font-medium mt-1">{delivery.salesOrder?.soNumber ?? '-'}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Requested Date</p><p className="font-medium mt-1">{formatDate(delivery.requestedDate)}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Created</p><p className="font-medium mt-1">{formatDate(delivery.createdAt)}</p></div>
              </div>
              {delivery.deliveryAddress && (<div className="mt-4 p-3 rounded-lg bg-muted/30"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Delivery Address</p><p className="text-sm whitespace-pre-wrap">{delivery.deliveryAddress}</p></div>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />Assignment</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {delivery.driver ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100"><User className="h-5 w-5 text-indigo-600" /></div>
                  <div><p className="text-sm font-medium">{delivery.driver.name}</p><p className="text-xs text-muted-foreground">{delivery.driver.email}</p>{delivery.driver.contactNumber && <p className="text-xs text-muted-foreground">{delivery.driver.contactNumber}</p>}</div>
                </div>
              ) : <p className="text-sm text-muted-foreground">No driver assigned</p>}
              {delivery.vehicle && (<div className="mt-3 text-sm"><span className="text-muted-foreground">Vehicle: </span><span className="font-medium">{delivery.vehicle.vehicleNumber}</span></div>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />Items</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider"><th className="pb-2 font-medium">Product</th><th className="pb-2 font-medium">SKU</th><th className="pb-2 font-medium text-right">Qty</th></tr></thead>
                <tbody>{delivery.lineItems.map((item) => (<tr key={item.id} className="border-b last:border-0"><td className="py-2 font-medium">{item.item?.name ?? item.description ?? '-'}</td><td className="py-2 text-muted-foreground">{item.item?.sku ?? '-'}</td><td className="py-2 text-right">{item.quantity}</td></tr>))}</tbody>
              </table>
            </CardContent>
          </Card>

          {delivery.shipments && (delivery.shipments ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Shipments</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {delivery.shipments.map((s) => (
                  <div key={s.id} className="space-y-1 text-sm mb-2">
                    <p><span className="text-muted-foreground">Shipment #:</span> {s.shipmentNumber}</p>
                    <p><span className="text-muted-foreground">Status:</span> <FulfillmentStatusBadge status={s.status} /></p>
                    {s.dispatchedAt && <p><span className="text-muted-foreground">Dispatched:</span> {formatDate(s.dispatchedAt)}</p>}
                    {s.deliveredAt && <p><span className="text-muted-foreground">Delivered:</span> {formatDate(s.deliveredAt)}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Actions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-2">
              {delivery.status === 'DISPATCHED' && (
                <Button className="w-full" onClick={() => deliverMutation.mutate()} disabled={deliverMutation.isPending}>
                  {deliverMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<CheckCircle2 className="mr-2 h-4 w-4" />Mark Delivered
                </Button>
              )}
              <Button variant="outline" className="w-full" asChild><Link href={`/fulfillment/orders/${delivery.id}`}>View Full Order</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
