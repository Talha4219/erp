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
import { Package, ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'

type CourierDetail = {
  id: string; fulfillmentNumber: string
  salesOrder?: { id: string; soNumber: string } | null
  customer: { id: string; name: string; email: string; phone: string }
  status: string; method: string
  deliveryAddress?: string | null
  requestedDate: string; createdAt: string
  lineItems: Array<{ id: string; item?: { name: string; sku: string } | null; description?: string | null; quantity: number }>
  shipments?: Array<{ id: string; shipmentNumber: string; status: string; driver?: { name: string } | null; vehicle?: { vehicleNumber: string } | null }>
}

export function PageClient({ id, initialData }: { id: string; initialData: CourierDetail }) {
  const router = useRouter()

  const { data: shipment, isLoading, error } = useQuery({
    queryKey: ['fulfillment-courier', id],
    queryFn: () => api.get<CourierDetail>(`/api/fulfillment/orders/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  if (isLoading) return (<div className="space-y-6"><div className="h-10 w-96 animate-pulse rounded-lg bg-muted" /><div className="h-48 animate-pulse rounded-xl bg-white border border-border/50" /></div>)
  if (error || !shipment) return <EmptyState icon={Package} title="Shipment not found" />

  return (
    <div className="space-y-6">
      <PageHeader title={shipment.fulfillmentNumber} description="Courier Shipment" icon={Package} iconColor="text-purple-600"
        badge={<FulfillmentStatusBadge status={shipment.status} />}
        actions={<Button variant="outline" size="sm" onClick={() => router.push('/fulfillment/courier')}><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Button>} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Shipment Information</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Customer</p><p className="font-medium mt-1">{shipment.customer.name}</p><p className="text-xs text-muted-foreground">{shipment.customer.email}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sales Order</p><p className="font-medium mt-1">{shipment.salesOrder?.soNumber ?? '-'}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Requested Date</p><p className="font-medium mt-1">{formatDate(shipment.requestedDate)}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Created</p><p className="font-medium mt-1">{formatDate(shipment.createdAt)}</p></div>
              </div>
              {shipment.deliveryAddress && (<div className="mt-4 p-3 rounded-lg bg-muted/30"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Delivery Address</p><p className="text-sm whitespace-pre-wrap">{shipment.deliveryAddress}</p></div>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />Items</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider"><th className="pb-2 font-medium">Product</th><th className="pb-2 font-medium">SKU</th><th className="pb-2 font-medium text-right">Qty</th></tr></thead>
                <tbody>{shipment.lineItems.map((item) => (<tr key={item.id} className="border-b last:border-0"><td className="py-2 font-medium">{item.item?.name ?? item.description ?? '-'}</td><td className="py-2 text-muted-foreground">{item.item?.sku ?? '-'}</td><td className="py-2 text-right">{item.quantity}</td></tr>))}</tbody>
              </table>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-5">
          <Button variant="outline" className="w-full" asChild><Link href={`/fulfillment/orders/${shipment.id}`}>View Full Order</Link></Button>
        </div>
      </div>
    </div>
  )
}
