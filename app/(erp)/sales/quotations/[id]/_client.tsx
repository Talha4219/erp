'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'

type QuotationDetail = {
  id: string
  quotationNumber: string
  status: string
  quotationDate: string
  expiryDate: string
  notes: string | null
  subTotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  customer: { id: string; name: string; email: string | null; phone: string | null }
  lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: number; discount: number; taxRate: number; totalPrice: number }>
  salesOrder: { id: string; soNumber: string } | null
}

const QUOTATION_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']

const statusVariant: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'secondary'> = {
  ACCEPTED: 'success',
  REJECTED: 'destructive',
  EXPIRED: 'destructive',
  SENT: 'info',
  DRAFT: 'secondary',
}

export function PageClient({ id, initialData }: { id: string; initialData: QuotationDetail }) {
  const router = useRouter()
  const qc = useQueryClient()

  const { data: quotation, isLoading } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => api.get<QuotationDetail>(`/api/sales/quotations/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/api/sales/quotations/${id}`, { status }),
    onSuccess: (res) => {
      toast.success('Status updated')
      if (res.success && res.data) qc.setQueryData(['quotation', id], res.data)
      qc.invalidateQueries({ queryKey: ['quotation', id] })
      qc.invalidateQueries({ queryKey: ['quotations'] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  const convertMutation = useMutation({
    mutationFn: () => api.patch(`/api/sales/quotations/${id}`, { action: 'convert-to-order' }),
    onSuccess: (res) => {
      toast.success('Sales order created')
      if (res.success && res.data) qc.setQueryData(['quotation', id], res.data)
      qc.invalidateQueries({ queryKey: ['quotation', id] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      if (res.data) router.push(`/sales/orders/${(res.data as { id: string }).id}`)
    },
    onError: () => toast.error('Failed to convert to order'),
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (!quotation) return <div className="p-6 text-muted-foreground">Quotation not found.</div>

  const canConvert = !quotation.salesOrder && quotation.status !== 'REJECTED' && quotation.status !== 'EXPIRED'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Quotation ${quotation.quotationNumber}`}
        description={`Customer: ${quotation.customer.name}`}
        actions={
          <div className="flex gap-2 flex-wrap">
            {canConvert && (
              <Button
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
                variant="outline"
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                {convertMutation.isPending ? 'Converting…' : 'Convert to Order'}
              </Button>
            )}
            {quotation.salesOrder && (
              <Button variant="outline" asChild>
                <Link href={`/sales/orders/${quotation.salesOrder.id}`}>
                  <ArrowRight className="mr-2 h-4 w-4" />Order {quotation.salesOrder.soNumber}
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/sales/quotations"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Status</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={statusVariant[quotation.status] ?? 'secondary'}>{quotation.status}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Quotation Date</p>
            <p className="mt-1 font-semibold">{formatDate(quotation.quotationDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Expiry Date</p>
            <p className="mt-1 font-semibold">{formatDate(quotation.expiryDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Total Amount</p>
            <p className="mt-1 text-lg font-bold">{formatCurrency(Number(quotation.totalAmount))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Update status */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-4">
          <p className="text-sm font-medium text-muted-foreground">Update Status:</p>
          <Select
            value={quotation.status}
            onValueChange={(val) => statusMutation.mutate(val)}
            disabled={statusMutation.isPending}
          >
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUOTATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Customer */}
        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Name: </span>{quotation.customer.name}</div>
            {quotation.customer.email && <div><span className="text-muted-foreground">Email: </span>{quotation.customer.email}</div>}
            {quotation.customer.phone && <div><span className="text-muted-foreground">Phone: </span>{quotation.customer.phone}</div>}
          </CardContent>
        </Card>

        {/* Financial summary */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Amounts</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(Number(quotation.subTotal))}</span>
            </div>
            {Number(quotation.discountAmount) > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount</span>
                <span>-{formatCurrency(Number(quotation.discountAmount))}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(Number(quotation.taxAmount))}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(Number(quotation.totalAmount))}</span>
            </div>
            {quotation.notes && <p className="pt-2 text-xs text-muted-foreground">Notes: {quotation.notes}</p>}
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
                  <th className="pb-2 pr-4 font-medium w-28 text-right">Unit Price</th>
                  <th className="pb-2 pr-4 font-medium w-16 text-right">Disc%</th>
                  <th className="pb-2 pr-4 font-medium w-16 text-right">Tax%</th>
                  <th className="pb-2 font-medium w-28 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {quotation.lineItems.map((li) => (
                  <tr key={li.id}>
                    <td className="py-2 pr-4">{li.description}</td>
                    <td className="py-2 pr-4">{Number(li.quantity)}</td>
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
    </div>
  )
}
