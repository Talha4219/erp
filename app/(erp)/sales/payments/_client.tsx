'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CrudListPage } from '@/components/shared/CrudListPage'
import type { Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DialogFooter } from '@/components/ui/dialog'

type Payment = { id: string; amount: number; paymentDate: string; method: string; reference: string | null; invoice: { invoiceNumber: string; customer: { name: string } } }
type Invoice = { id: string; invoiceNumber: string; customer: { name: string }; totalAmount: number; paidAmount: number }

const METHODS = ['CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'ONLINE', 'OTHER']

const columns: Column<Payment>[] = [
  { key: 'date', header: 'Date', render: (r) => formatDate(r.paymentDate) },
  { key: 'customer', header: 'Customer', render: (r) => r.invoice.customer.name },
  { key: 'invoice', header: 'Invoice', render: (r) => r.invoice.invoiceNumber },
  { key: 'amount', header: 'Amount', render: (r) => formatCurrency(Number(r.amount)) },
  { key: 'method', header: 'Method', render: (r) => r.method.replace(/_/g, ' ') },
  { key: 'reference', header: 'Reference', render: (r) => r.reference ?? '—' },
]

function PaymentForm({ onSave, onCancel, isPending }: {
  editing: Payment | null
  onSave: (data: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState({ invoiceId: '', amount: '', paymentDate: '', method: 'BANK_TRANSFER', reference: '', notes: '' })
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-list'],
    queryFn: () => api.get<Invoice[]>('/api/sales/invoices').then((r) => r.data ?? []),
  })

  const selected = invoices.find((i) => i.id === form.invoiceId)
  const outstanding = selected ? Number(selected.totalAmount) - Number(selected.paidAmount) : 0

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Invoice *</Label>
        <Select value={form.invoiceId} onValueChange={(v) => {
          const inv = invoices.find((i) => i.id === v)
          setForm((p) => ({ ...p, invoiceId: v, amount: inv ? String(Number(inv.totalAmount - inv.paidAmount).toFixed(2)) : p.amount }))
        }}>
          <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
          <SelectContent>{invoices.map((i) => <SelectItem key={i.id} value={i.id}>{i.invoiceNumber} — {i.customer.name}</SelectItem>)}</SelectContent>
        </Select>
        {selected && <p className="text-xs text-muted-foreground">Outstanding: {formatCurrency(outstanding)}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Payment Date *</Label><Input type="date" value={form.paymentDate} onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Method *</Label>
          <Select value={form.method} onValueChange={(v) => setForm((p) => ({ ...p, method: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} /></div>
      </div>
      <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={isPending || !form.invoiceId || !form.amount || !form.paymentDate}>
          {isPending ? 'Saving…' : 'Record'}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function PageClient({ initialData }: { initialData: Payment[] }) {
  return (
    <CrudListPage<Payment>
      title="Payment Collection"
      description="Record and manage customer payments"
      queryKey={['customer-payments']}
      apiEndpoint="/api/sales/payments"
      initialData={initialData}
      columns={columns}
      addButtonLabel="Record Payment"
      onSave={async (formData, id) => {
        if (id) await api.patch(`/api/sales/payments/${id}`, formData)
        else await api.post('/api/sales/payments', formData)
      }}
      FormComponent={PaymentForm}
      formTitle="Record Payment"
    />
  )
}
