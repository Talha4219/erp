'use client'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FulfillmentStatusBadge } from '@/components/modules/fulfillment/FulfillmentStatusBadge'
import { FulfillmentMethodBadge } from '@/components/modules/fulfillment/FulfillmentMethodBadge'
import { toast } from 'sonner'
import {
  Truck, Package, ArrowLeft, CheckCircle2, ClipboardList,
  Calendar, FileText, AlertTriangle, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { DetailPageSkeleton } from '@/components/modules/fulfillment/FulfillmentSkeletons'

type LineItem = {
  id: string
  item?: { id: string; name: string; sku: string } | null
  description: string
  quantity: number
}
type OrderDetail = {
  id: string; fulfillmentNumber: string; soId: string
  salesOrder: { id: string; soNumber: string }
  customer: { id: string; name: string; email: string; phone: string }
  method: string; status: string; priority: string
  warehouse?: { id: string; name: string } | null
  deliveryAddress?: string | null; pickupLocation?: string | null
  requestedDate?: string | null; createdAt: string; notes?: string | null
  lineItems: LineItem[]
  driver?: { id: string; name: string } | null
  vehicle?: { id: string; vehicleNumber: string } | null
  shipments?: Array<{ id: string; shipmentNumber: string; status: string; driver?: { name: string } | null; vehicle?: { vehicleNumber: string } | null }>
}

export function PageClient({ id, initialData }: { id: string; initialData: OrderDetail }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['fulfillment-order', id],
    queryFn: () => api.get<OrderDetail>(`/api/fulfillment/orders/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const actionMutation = useMutation({
    mutationFn: (action: string) => api.post(`/api/fulfillment/orders/${id}/${action}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment-order', id] })
      toast.success('Status updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <DetailPageSkeleton />
  if (error || !order) return <EmptyState icon={AlertTriangle} title="Order not found" description="Could not load this fulfillment order." />

  const renderActionButtons = () => {
    const s = order.status
    return (
      <div className="flex flex-wrap gap-2 mt-4">
        {s === 'DRAFT' && (
          <Button onClick={() => actionMutation.mutate('approve')} disabled={actionMutation.isPending}>
            {actionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Approve
          </Button>
        )}
        {s === 'APPROVED' && (
          <Button onClick={() => actionMutation.mutate('dispatch')} disabled={actionMutation.isPending}>
            {actionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Dispatch
          </Button>
        )}
        {s === 'DISPATCHED' && (
          <Button onClick={() => actionMutation.mutate('deliver')} disabled={actionMutation.isPending}>
            {actionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark Delivered
          </Button>
        )}
        {!['DRAFT', 'CANCELLED', 'DELIVERED', 'COLLECTED', 'RETURNED'].includes(s) && (
          <Button variant="outline" className="text-red-600 border-red-200" onClick={() => actionMutation.mutate('cancel')} disabled={actionMutation.isPending}>
            Cancel
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.fulfillmentNumber}
        description={`Sales Order: ${order.salesOrder?.soNumber ?? '-'}`}
        icon={Package} iconColor="text-indigo-600"
        badge={<div className="flex items-center gap-2"><FulfillmentStatusBadge status={order.status} /><FulfillmentMethodBadge method={order.method} /></div>}
        actions={<Button variant="outline" size="sm" onClick={() => router.push('/fulfillment/orders')}><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Button>}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />Order Information</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Customer</p><p className="font-medium mt-1">{order.customer.name}</p><p className="text-xs text-muted-foreground">{order.customer.email}</p>{order.customer.phone && <p className="text-xs text-muted-foreground">{order.customer.phone}</p>}</div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sales Order</p><Link href={`/sales/orders/${order.soId}`} className="font-medium text-primary hover:underline mt-1 block">{order.salesOrder?.soNumber ?? '-'}</Link></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Warehouse</p><p className="font-medium mt-1">{order.warehouse?.name ?? '-'}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Priority</p><Badge variant={order.priority === 'HIGH' || order.priority === 'URGENT' ? 'destructive' : 'secondary'}>{order.priority}</Badge></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Requested Date</p><p className="font-medium mt-1">{formatDate(order.requestedDate)}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Created</p><p className="font-medium mt-1">{formatDate(order.createdAt)}</p></div>
              </div>
              {order.deliveryAddress && (<div className="mt-4"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Delivery Address</p><p className="text-sm mt-1 whitespace-pre-wrap">{order.deliveryAddress}</p></div>)}
              {order.pickupLocation && (<div className="mt-4"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Pickup Location</p><p className="text-sm mt-1">{order.pickupLocation}</p></div>)}
              {order.notes && (<div className="mt-4"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p><p className="text-sm mt-1 text-muted-foreground">{order.notes}</p></div>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><ClipboardList className="h-4 w-4 text-muted-foreground" />Line Items</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider"><th className="pb-2 font-medium">Product</th><th className="pb-2 font-medium">SKU</th><th className="pb-2 font-medium text-right">Qty</th></tr></thead>
                <tbody>{order.lineItems.map((item) => (<tr key={item.id} className="border-b last:border-0"><td className="py-2 font-medium">{item.item?.name ?? item.description}</td><td className="py-2 text-muted-foreground">{item.item?.sku ?? '-'}</td><td className="py-2 text-right">{item.quantity}</td></tr>))}</tbody>
              </table>
            </CardContent>
          </Card>

          {(order.driver || order.vehicle) && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" />Delivery Assignment</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {order.driver && (<div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Driver</p><Link href={`/fulfillment/drivers/${order.driver.id}`} className="font-medium text-primary hover:underline mt-1 block">{order.driver.name}</Link></div>)}
                  {order.vehicle && (<div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Vehicle</p><Link href={`/fulfillment/vehicles/${order.vehicle?.id ?? ''}`} className="font-medium text-primary hover:underline mt-1 block">{order.vehicle?.vehicleNumber ?? '-'}</Link></div>)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-muted-foreground" />Actions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">{renderActionButtons()}</CardContent>
          </Card>
          {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />Status Timeline</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-3">
                  {['DRAFT', 'APPROVED', 'DISPATCHED', 'DELIVERED'].map((step) => {
                    const statusOrder = ['DRAFT', 'APPROVED', 'DISPATCHED', 'DELIVERED']
                    const currentIdx = statusOrder.indexOf(order.status)
                    const stepIdx = statusOrder.indexOf(step)
                    const done = stepIdx <= currentIdx && order.status !== 'CANCELLED'
                    return (<div key={step} className="flex items-center gap-3"><div className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-gray-200'}`} /><span className={`text-xs ${done ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{step.replace(/_/g, ' ')}</span></div>)
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
