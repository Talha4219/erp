'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type FulfillmentOrder = {
  id: string
  fulfillmentNumber: string
  customerId: string
  customer: { id: string; name: string }
  lineItems: Array<{
    id: string
    description: string
    quantity: number
    item?: { id: string; name: string; sku: string } | null
  }>
}

export function PageClient({ orders }: { orders: FulfillmentOrder[] }) {
  const router = useRouter()

  const [orderId, setOrderId] = useState('')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState('')
  const [resolution, setResolution] = useState('')
  const [notes, setNotes] = useState('')
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({})

  const createMutation = useMutation({
    mutationFn: (body: unknown) => api.post<{ id: string }>('/api/fulfillment/returns', body),
    onSuccess: (res) => {
      if (!res.data?.id) { toast.error('Failed to create return'); return }
      toast.success('Return request created')
      router.push(`/fulfillment/returns/${res.data.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const selectedOrder = orders?.find((o) => o.id === orderId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderId || !reason) {
      toast.error('Please select an order and provide a reason')
      return
    }

    const items = selectedOrder?.lineItems
      .filter((li) => (returnQuantities[li.id] ?? 0) > 0)
      .map((li) => ({
        itemId: li.item?.id,
        description: li.description,
        quantity: returnQuantities[li.id],
        unitPrice: 0,
      })) ?? []

    if (items.length === 0) {
      toast.error('Please select at least one item to return')
      return
    }

    createMutation.mutate({
      fulfillmentId: orderId,
      customerId: selectedOrder!.customerId,
      returnDate,
      reason,
      resolution: resolution || undefined,
      notes: notes || undefined,
      lineItems: items,
    })
  }

  const updateQty = (lineItemId: string, max: number, val: string) => {
    const qty = Math.min(max, Math.max(0, parseInt(val) || 0))
    setReturnQuantities((prev) => ({ ...prev, [lineItemId]: qty }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Return Request"
        description="Create a return request"
        icon={ArrowLeft}
        iconColor="text-rose-600"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/fulfillment/returns"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-3xl">
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Return Details</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Fulfillment Order</Label>
              <select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Select order...</option>
                {(orders ?? []).map((o) => (
                  <option key={o.id} value={o.id}>{o.fulfillmentNumber} - {o.customer.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Return Date *</Label>
                <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Reason *</Label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select reason...</option>
                  <option value="DAMAGED">Damaged Item</option>
                  <option value="DEFECTIVE">Defective</option>
                  <option value="WRONG_ITEM">Wrong Item</option>
                  <option value="CUSTOMER_RETURN">Customer Return</option>
                  <option value="QUALITY_ISSUE">Quality Issue</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Resolution</Label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="REFUND">Refund</option>
                  <option value="REPLACEMENT">Replacement</option>
                  <option value="CREDIT_NOTE">Credit Note</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes" rows={2} />
            </div>
          </CardContent>
        </Card>

        {selectedOrder && selectedOrder.lineItems.length > 0 && (
          <Card className="mt-5">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Items to Return</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium text-right">Ordered</th>
                    <th className="pb-2 font-medium text-right">Return Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.lineItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{item.item?.name ?? item.description}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={item.quantity}
                          value={returnQuantities[item.id] ?? 0}
                          onChange={(e) => updateQty(item.id, item.quantity, e.target.value)}
                          className="w-20 h-8 rounded-md border border-input bg-background px-2 text-sm text-right"
                        />
                      </td>
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
            Create Return Request
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link href="/fulfillment/returns">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
