'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'


type SalesOrder = {
  id: string
  soNumber: string
  customer: { id: string; name: string; email: string }
  lineItems: Array<{ id: string; item?: { id: string; name: string; sku: string } | null; description: string; quantity: number; unitPrice: number }>
}

type Warehouse = { id: string; name: string }
type Driver = { id: string; name: string; status: string }
type Vehicle = { id: string; vehicleNumber: string; status: string }

export function PageClient({ salesOrders, warehouses: prefetchedWarehouses }: { salesOrders: SalesOrder[]; warehouses: Warehouse[] }) {
  const router = useRouter()

  const [soId, setSoId] = useState('')
  const [method, setMethod] = useState('COMPANY_DELIVERY')
  const [warehouseId, setWarehouseId] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [requestedDate, setRequestedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [assignedDriverId, setAssignedDriverId] = useState('')
  const [assignedVehicleId, setAssignedVehicleId] = useState('')

  const { data: drivers } = useQuery({
    queryKey: ['drivers-available'],
    queryFn: () => api.get<Driver[]>('/api/fulfillment/drivers').then((r) => (r.data ?? []).filter((d: Driver) => d.status === 'AVAILABLE')),
    enabled: method === 'COMPANY_DELIVERY',
  })

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles-available'],
    queryFn: () => api.get<Vehicle[]>('/api/fulfillment/vehicles').then((r) => (r.data ?? []).filter((v: Vehicle) => v.status === 'AVAILABLE')),
    enabled: method === 'COMPANY_DELIVERY',
  })

  const createMutation = useMutation({
    mutationFn: (body: unknown) => api.post<{ id: string }>('/api/fulfillment/orders', body),
    onSuccess: (res) => {
      if (!res.data?.id) { toast.error('Failed to create order'); return }
      toast.success('Fulfillment order created')
      router.push(`/fulfillment/orders/${res.data.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const selectedSO = salesOrders?.find((so) => so.id === soId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!soId || !warehouseId) {
      toast.error('Please select a sales order and warehouse')
      return
    }
    const items = selectedSO?.lineItems.map((li) => ({
      soItemId: li.id,
      itemId: li.item?.id,
      description: li.item?.name ?? li.description,
      quantity: Number(li.quantity),
    })) ?? []
    if (items.length === 0) { toast.error('Sales order has no line items'); return }

    createMutation.mutate({
      soId,
      method,
      warehouseId,
      deliveryAddress: method === 'COMPANY_DELIVERY' ? deliveryAddress : undefined,
      pickupLocation: method === 'CUSTOMER_PICKUP' ? pickupLocation : undefined,
      priority,
      requestedDate: requestedDate || undefined,
      notes: notes || undefined,
      assignedDriverId: method === 'COMPANY_DELIVERY' ? (assignedDriverId || null) : undefined,
      assignedVehicleId: method === 'COMPANY_DELIVERY' ? (assignedVehicleId || null) : undefined,
      lineItems: items,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Fulfillment Order"
        description="Create a fulfillment order from a sales order"
        icon={Plus}
        iconColor="text-indigo-600"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/fulfillment/orders"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-3xl">
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Order Details</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Sales Order</Label>
              <select
                value={soId}
                onChange={(e) => setSoId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Select sales order...</option>
                {(salesOrders ?? []).map((so) => (
                  <option key={so.id} value={so.id}>{so.soNumber} - {so.customer.name}</option>
                ))}
              </select>
              {selectedSO && (
                <p className="text-xs text-muted-foreground">
                  Customer: {selectedSO.customer.name} ({selectedSO.customer.email}) · {selectedSO.lineItems.length} item(s)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Fulfillment Method</Label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="COMPANY_DELIVERY">Company Delivery</option>
                <option value="CUSTOMER_PICKUP">Customer Pickup</option>
                <option value="CUSTOMER_TRANSPORT">Customer Transport</option>
                <option value="COURIER">Courier</option>
                <option value="INTERNAL_TRANSFER">Internal Transfer</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Warehouse</Label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Select warehouse...</option>
                {(prefetchedWarehouses ?? []).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {method === 'COMPANY_DELIVERY' && (
              <>
                <div className="space-y-2">
                  <Label>Delivery Address</Label>
                  {selectedSO && (
                    <p className="text-xs text-muted-foreground mb-1">
                      Customer: {selectedSO.customer.name}
                    </p>
                  )}
                  <Textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter delivery address"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Driver</Label>
                    <select
                      value={assignedDriverId}
                      onChange={(e) => setAssignedDriverId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select driver...</option>
                      {(drivers ?? []).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vehicle</Label>
                    <select
                      value={assignedVehicleId}
                      onChange={(e) => setAssignedVehicleId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select vehicle...</option>
                      {(vehicles ?? []).map((v) => (
                        <option key={v.id} value={v.id}>{v.vehicleNumber}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {method === 'CUSTOMER_PICKUP' && (
              <div className="space-y-2">
                <Label>Pickup Location</Label>
                <Input
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder="e.g. Warehouse A, Dock 3"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Requested Date</Label>
                <Input
                  type="date"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items Preview */}
        {selectedSO && selectedSO.lineItems.length > 0 && (
          <Card className="mt-5">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Line Items (from Sales Order)</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">SKU</th>
                    <th className="pb-2 font-medium text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSO.lineItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{item.item?.name ?? item.description}</td>
                      <td className="py-2 text-muted-foreground">{item.item?.sku ?? '-'}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Fulfillment Order
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link href="/fulfillment/orders">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
