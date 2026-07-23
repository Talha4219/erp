'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CheckCircle2, AlertTriangle, Package, Truck, FileText, ShoppingCart, RotateCcw, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Reservation = { id: string; itemId: string; warehouseId: string; reservedQty: number }
type Requisition = { id: string; prNumber: string; status: string }

type SalesOrderDetail = {
  id: string
  soNumber: string
  status: string
  orderDate: string
  deliveryDate: string | null
  notes: string | null
  subTotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  customer: { id: string; name: string; email: string | null; phone: string | null; creditLimit: number | null }
  lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: number; discount: number; taxRate: number; totalPrice: number; deliveredQty: number }>
  quotation: { id: string; quotationNumber: string } | null
  invoices: Array<{ id: string; invoiceNumber: string; status: string; totalAmount: number }>
  reservations: Reservation[]
  requisitions: Requisition[]
}

type WorkflowStep = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WorkflowStep[] = [
  { key: 'DRAFT',       label: 'Order Entry',       icon: FileText },
  { key: 'CONFIRMED',   label: 'Confirmed',          icon: CheckCircle2 },
  { key: 'PENDING_PO',  label: 'Awaiting Stock',     icon: ShoppingCart },
  { key: 'RESERVED',    label: 'Stock Reserved',     icon: Package },
  { key: 'PICKING',     label: 'Pick & Pack',        icon: Package },
  { key: 'PACKED',      label: 'Packed',             icon: Package },
  { key: 'SHIPPED',     label: 'Shipped / Invoiced', icon: Truck },
  { key: 'DELIVERED',   label: 'Delivered',          icon: CheckCircle2 },
]

const NORMAL_FLOW = ['DRAFT','CONFIRMED','RESERVED','PICKING','PACKED','SHIPPED','DELIVERED']

const statusVariant: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'secondary'> = {
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  SHIPPED: 'warning',
  CONFIRMED: 'info',
  RESERVED: 'info',
  PICKING: 'warning',
  PACKED: 'warning',
  PENDING_PO: 'secondary',
  CREDIT_HOLD: 'destructive',
  DRAFT: 'secondary',
}

const invoiceStatusVariant: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'secondary'> = {
  PAID: 'success',
  OVERDUE: 'destructive',
  PARTIALLY_PAID: 'warning',
  SENT: 'info',
  DRAFT: 'secondary',
  CANCELLED: 'secondary',
}

export function PageClient({ id, initialData }: { id: string; initialData: SalesOrderDetail }) {
  const router = useRouter()
  const qc = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: () => api.get<SalesOrderDetail>(`/api/sales/orders/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const updateCache = (res: { success: boolean; data: any }) => {
    if (res.success && res.data) qc.setQueryData(['sales-order', id], res.data)
  }
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['sales-order', id] })
    qc.invalidateQueries({ queryKey: ['sales-orders'] })
  }

  const confirmMutation = useMutation({
    mutationFn: () => api.patch(`/api/sales/orders/${id}`, { status: 'CONFIRMED' }),
    onSuccess: (res) => { toast.success('Order confirmed'); updateCache(res); invalidate() },
    onError: () => toast.error('Failed'),
  })

  const checkInventoryMutation = useMutation({
    mutationFn: () => api.post(`/api/sales/orders/${id}/check-inventory`, {}),
    onSuccess: (res) => {
      const d = res.data as { status: string; prNumber?: string }
      if (d.status === 'RESERVED') toast.success('Stock reserved — ready for credit check')
      else toast.warning(`Stock insufficient — Purchase Requisition ${d.prNumber} created`)
      invalidate()
    },
    onError: () => toast.error('Inventory check failed'),
  })

  const creditCheckMutation = useMutation({
    mutationFn: () => api.post(`/api/sales/orders/${id}/credit-check`, {}),
    onSuccess: (res) => {
      const d = res.data as { approved: boolean; reason?: string }
      if (d.approved) toast.success('Credit check passed — order moved to picking')
      else toast.error('Credit check failed — order on hold')
      invalidate()
    },
    onError: () => toast.error('Credit check failed'),
  })

  const pickMutation = useMutation({
    mutationFn: () => api.post(`/api/sales/orders/${id}/pick`, {}),
    onSuccess: () => { toast.success('Order packed'); invalidate() },
    onError: () => toast.error('Failed'),
  })

  const shipMutation = useMutation({
    mutationFn: () => api.post(`/api/sales/orders/${id}/ship`, {}),
    onSuccess: (res) => {
      const d = res.data as { invoice: { id: string; invoiceNumber: string } }
      toast.success(`Shipped — Invoice ${d.invoice.invoiceNumber} created`)
      invalidate()
      router.push(`/sales/invoices/${d.invoice.id}`)
    },
    onError: () => toast.error('Shipping failed'),
  })

  const releaseHoldMutation = useMutation({
    mutationFn: () => api.patch(`/api/sales/orders/${id}`, { action: 'release-hold' }),
    onSuccess: (res) => { toast.success('Hold released — order moved to picking'); updateCache(res); invalidate() },
    onError: () => toast.error('Failed to release hold'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/api/sales/orders/${id}`, { status: 'CANCELLED' }),
    onSuccess: (res) => { toast.success('Order cancelled'); updateCache(res); invalidate() },
    onError: () => toast.error('Failed'),
  })

  const deliverMutation = useMutation({
    mutationFn: () => api.patch(`/api/sales/orders/${id}`, { status: 'DELIVERED' }),
    onSuccess: (res) => { toast.success('Order marked as delivered'); updateCache(res); invalidate() },
    onError: () => toast.error('Failed'),
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (!order) return <div className="p-6 text-muted-foreground">Sales order not found.</div>

  const currentIdx = NORMAL_FLOW.indexOf(order.status)
  const pr = order.requisitions[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Sales Order ${order.soNumber}`}
        description={`Customer: ${order.customer.name}`}
        actions={
          <div className="flex gap-2 flex-wrap">
            {order.quotation && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/sales/quotations/${order.quotation.id}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />Quote {order.quotation.quotationNumber}
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/sales/orders"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
            </Button>
          </div>
        }
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Status</p>
            <div className="mt-2">
              <Badge variant={statusVariant[order.status] ?? 'secondary'}>{order.status.replace(/_/g, ' ')}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Order Date</p>
            <p className="mt-1 font-semibold">{formatDate(order.orderDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Delivery Date</p>
            <p className="mt-1 font-semibold">{order.deliveryDate ? formatDate(order.deliveryDate) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Total Amount</p>
            <p className="mt-1 text-lg font-bold">{formatCurrency(Number(order.totalAmount))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Stepper */}
      <Card>
        <CardHeader><CardTitle>Order Workflow</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-start gap-0 overflow-x-auto pb-2">
            {STEPS.filter((s) => s.key !== 'PENDING_PO').map((step, i, arr) => {
              const isCurrent = step.key === order.status
              const isDone = currentIdx > NORMAL_FLOW.indexOf(step.key) && currentIdx !== -1
              const isPending = !isCurrent && !isDone
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[90px]">
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors',
                      isDone && 'bg-green-500 border-green-500 text-white',
                      isCurrent && 'bg-primary border-primary text-primary-foreground',
                      isPending && 'bg-background border-muted-foreground/30 text-muted-foreground',
                    )}>
                      {isDone
                        ? <CheckCircle2 className="w-5 h-5" />
                        : <step.icon className="w-4 h-4" />}
                    </div>
                    <p className={cn('mt-1 text-[11px] text-center leading-tight',
                      isCurrent && 'font-semibold text-primary',
                      isDone && 'text-green-600',
                      isPending && 'text-muted-foreground',
                    )}>{step.label}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={cn('h-0.5 w-8 -mt-4 flex-shrink-0',
                      isDone ? 'bg-green-400' : 'bg-muted-foreground/20'
                    )} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Workflow action buttons */}
          <div className="mt-5 flex flex-wrap gap-3 items-center">
            {order.status === 'DRAFT' && (
              <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {confirmMutation.isPending ? 'Confirming…' : 'Confirm Order'}
              </Button>
            )}

            {order.status === 'CONFIRMED' && (
              <Button onClick={() => checkInventoryMutation.mutate()} disabled={checkInventoryMutation.isPending}>
                <Package className="mr-2 h-4 w-4" />
                {checkInventoryMutation.isPending ? 'Checking…' : 'Check Inventory'}
              </Button>
            )}

            {order.status === 'PENDING_PO' && pr && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <AlertTriangle className="h-4 w-4" />
                  Waiting for stock from <strong>{pr.prNumber}</strong>
                  <Badge variant="secondary" className="ml-1">{pr.status}</Badge>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/procurement/purchase-requests`}>
                    <ExternalLink className="mr-2 h-4 w-4" />View PR
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => checkInventoryMutation.mutate()} disabled={checkInventoryMutation.isPending}>
                  <RotateCcw className="mr-2 h-4 w-4" />Re-check Stock
                </Button>
              </div>
            )}

            {order.status === 'RESERVED' && (
              <>
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {order.reservations.length} reservation(s) active
                </div>
                <Button onClick={() => creditCheckMutation.mutate()} disabled={creditCheckMutation.isPending}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {creditCheckMutation.isPending ? 'Checking…' : 'Run Credit Check'}
                </Button>
              </>
            )}

            {order.status === 'CREDIT_HOLD' && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  <AlertTriangle className="h-4 w-4" />
                  Order on credit hold — notify sales team or release manually
                </div>
                <Button variant="outline" onClick={() => releaseHoldMutation.mutate()} disabled={releaseHoldMutation.isPending}>
                  {releaseHoldMutation.isPending ? 'Releasing…' : 'Release Hold'}
                </Button>
              </div>
            )}

            {order.status === 'PICKING' && (
              <Button onClick={() => pickMutation.mutate()} disabled={pickMutation.isPending}>
                <Package className="mr-2 h-4 w-4" />
                {pickMutation.isPending ? 'Updating…' : 'Confirm Pack Complete'}
              </Button>
            )}

            {order.status === 'PACKED' && (
              <Button onClick={() => shipMutation.mutate()} disabled={shipMutation.isPending} className="bg-green-600 hover:bg-green-700">
                <Truck className="mr-2 h-4 w-4" />
                {shipMutation.isPending ? 'Shipping…' : 'Ship & Generate Invoice'}
              </Button>
            )}

            {order.status === 'SHIPPED' && (
              <Button variant="outline" onClick={() => deliverMutation.mutate()} disabled={deliverMutation.isPending}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {deliverMutation.isPending ? 'Updating…' : 'Mark Delivered'}
              </Button>
            )}

            {!['CANCELLED', 'DELIVERED', 'SHIPPED'].includes(order.status) && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-auto"
                onClick={() => { if (confirm('Cancel this order?')) cancelMutation.mutate() }}
                disabled={cancelMutation.isPending}>
                Cancel Order
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Customer */}
        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Name: </span>{order.customer.name}</div>
            {order.customer.email && <div><span className="text-muted-foreground">Email: </span>{order.customer.email}</div>}
            {order.customer.phone && <div><span className="text-muted-foreground">Phone: </span>{order.customer.phone}</div>}
            {order.customer.creditLimit != null && (
              <div><span className="text-muted-foreground">Credit Limit: </span>{formatCurrency(Number(order.customer.creditLimit))}</div>
            )}
          </CardContent>
        </Card>

        {/* Financial summary */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Amounts</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(Number(order.subTotal))}</span>
            </div>
            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount</span>
                <span>-{formatCurrency(Number(order.discountAmount))}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(Number(order.taxAmount))}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(Number(order.totalAmount))}</span>
            </div>
            {order.notes && <p className="pt-2 text-xs text-muted-foreground">Notes: {order.notes}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Line items */}
      <Card>
        <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Description</th>
                  <th className="pb-2 pr-4 font-medium w-16">Qty</th>
                  <th className="pb-2 pr-4 font-medium w-20">Delivered</th>
                  <th className="pb-2 pr-4 font-medium w-28 text-right">Unit Price</th>
                  <th className="pb-2 pr-4 font-medium w-16 text-right">Disc%</th>
                  <th className="pb-2 pr-4 font-medium w-16 text-right">Tax%</th>
                  <th className="pb-2 font-medium w-28 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.lineItems.map((li) => (
                  <tr key={li.id}>
                    <td className="py-2 pr-4">{li.description}</td>
                    <td className="py-2 pr-4">{Number(li.quantity)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{Number(li.deliveredQty)}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(Number(li.unitPrice))}</td>
                    <td className="py-2 pr-4 text-right">{Number(li.discount)}%</td>
                    <td className="py-2 pr-4 text-right">{Number(li.taxRate)}%</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(Number(li.totalPrice))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Linked invoices */}
      {order.invoices.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Linked Invoices</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Invoice #</th>
                  <th className="pb-2 pr-4 font-medium text-right">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2 pr-4">
                      <Link href={`/sales/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(Number(inv.totalAmount))}</td>
                    <td className="py-2">
                      <Badge variant={invoiceStatusVariant[inv.status] ?? 'secondary'}>{inv.status.replace(/_/g, ' ')}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
