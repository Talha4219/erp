'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'

type InvoiceDetail = {
  id: string
  invoiceNumber: string
  status: string
  invoiceDate: string
  dueDate: string
  notes: string | null
  subTotal: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  customer: { id: string; name: string; email: string | null; phone: string | null }
  lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: number; discount: number; taxRate: number; totalPrice: number }>
  payments: Array<{ id: string; amount: number; paymentDate: string; method: string; reference: string | null }>
}

const statusVariant: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'secondary'> = {
  PAID: 'success',
  OVERDUE: 'destructive',
  PARTIALLY_PAID: 'warning',
  SENT: 'info',
  DRAFT: 'secondary',
  CANCELLED: 'secondary',
}

const PAYMENT_METHODS = ['Bank Transfer', 'Cash', 'Cheque', 'Card', 'Online']

export function PageClient({ id, initialData }: { id: string; initialData: InvoiceDetail }) {
  const qc = useQueryClient()
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payMethod, setPayMethod] = useState('Bank Transfer')
  const [payRef, setPayRef] = useState('')

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<InvoiceDetail>(`/api/sales/invoices/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const payMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/sales/invoices/${id}/payments`, {
        amount: Number(payAmount),
        paymentDate: payDate,
        method: payMethod,
        reference: payRef || undefined,
      }),
    onSuccess: () => {
      toast.success('Payment recorded')
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setShowPaymentForm(false)
      setPayAmount('')
      setPayRef('')
    },
    onError: () => toast.error('Failed to record payment'),
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/api/sales/invoices/${id}`, { status }),
    onSuccess: (res) => {
      toast.success('Status updated')
      if (res.success && res.data) qc.setQueryData(['invoice', id], res.data)
      qc.invalidateQueries({ queryKey: ['invoice', id] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (!invoice) return <div className="p-6 text-muted-foreground">Invoice not found.</div>

  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`Customer: ${invoice.customer.name}`}
        actions={
          <div className="flex gap-2">
            {invoice.status === 'DRAFT' && (
              <Button variant="outline" onClick={() => statusMutation.mutate('SENT')} disabled={statusMutation.isPending}>
                Mark as Sent
              </Button>
            )}
            {balance > 0 && invoice.status !== 'CANCELLED' && (
              <Button onClick={() => setShowPaymentForm(true)}>
                <Plus className="mr-2 h-4 w-4" />Record Payment
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/sales/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Status</p>
            <div className="mt-1">
              <Badge variant={statusVariant[invoice.status] ?? 'secondary'}>{invoice.status.replace(/_/g, ' ')}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Invoice Date</p>
            <p className="mt-1 font-semibold">{formatDate(invoice.invoiceDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Due Date</p>
            <p className="mt-1 font-semibold">{formatDate(invoice.dueDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-medium">Balance Due</p>
            <p className={`mt-1 text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Customer */}
        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Name: </span>{invoice.customer.name}</div>
            {invoice.customer.email && <div><span className="text-muted-foreground">Email: </span>{invoice.customer.email}</div>}
            {invoice.customer.phone && <div><span className="text-muted-foreground">Phone: </span>{invoice.customer.phone}</div>}
          </CardContent>
        </Card>

        {/* Financial summary */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Amounts</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(Number(invoice.subTotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(Number(invoice.taxAmount))}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(Number(invoice.totalAmount))}</span>
            </div>
            <div className="flex justify-between text-green-700">
              <span>Paid</span>
              <span>{formatCurrency(Number(invoice.paidAmount))}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Balance Due</span>
              <span className={balance > 0 ? 'text-red-600' : 'text-green-600'}>{formatCurrency(balance)}</span>
            </div>
            {invoice.notes && <p className="pt-2 text-xs text-muted-foreground">Notes: {invoice.notes}</p>}
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
                {invoice.lineItems.map((li) => (
                  <tr key={li.id}>
                    <td className="py-2 pr-4">{li.description}</td>
                    <td className="py-2 pr-4">{li.quantity}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(Number(li.unitPrice))}</td>
                    <td className="py-2 pr-4 text-right">{li.discount}%</td>
                    <td className="py-2 pr-4 text-right">{li.taxRate}%</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(Number(li.totalPrice))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showPaymentForm && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="font-medium text-sm">Record Payment</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label>Amount *</Label>
                  <Input type="number" min="0.01" step="0.01" value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)} placeholder={formatCurrency(balance)} />
                </div>
                <div className="space-y-1">
                  <Label>Date *</Label>
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Method</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Reference</Label>
                  <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Ref #" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => payMutation.mutate()} disabled={payMutation.isPending || !payAmount}>
                  {payMutation.isPending ? 'Saving...' : 'Save Payment'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowPaymentForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {invoice.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Method</th>
                  <th className="pb-2 pr-4 font-medium">Reference</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4">{formatDate(p.paymentDate)}</td>
                    <td className="py-2 pr-4">{p.method}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{p.reference ?? '—'}</td>
                    <td className="py-2 text-right font-medium text-green-700">{formatCurrency(Number(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
