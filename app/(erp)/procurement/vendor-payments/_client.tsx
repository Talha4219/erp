'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

type Payment = { id: string; amount: number; paymentDate: string; paymentMethod: string; reference: string | null; vendorInvoice: { invoiceNumber: string; vendor: { name: string } } }
type VInvoice = { id: string; invoiceNumber: string; totalAmount: number; paidAmount: number; vendor: { name: string } }
const METHODS = ['BANK_TRANSFER','CHEQUE','CASH','CARD','OTHER']

export function PageClient({ initialPayments, initialInvoices }: { initialPayments: Payment[]; initialInvoices: VInvoice[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ vendorInvoiceId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'BANK_TRANSFER', reference: '' })

  const { data: payments = [], error: paymentsError } = useQuery({
    queryKey: ['vendor-payments'],
    queryFn: () => api.get<Payment[]>('/api/procurement/vendor-payments').then(r => r.data ?? []),
    initialData: initialPayments,
    staleTime: 30_000,
  })

  const { data: invoices = [] } = useQuery({
    queryKey: ['vendor-invoices'],
    queryFn: () => api.get<VInvoice[]>('/api/procurement/vendor-invoices').then(r => r.data ?? []),
    initialData: initialInvoices,
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/procurement/vendor-payments', {
      vendorInvoiceId: form.vendorInvoiceId, amount: Number(form.amount),
      paymentDate: form.paymentDate, paymentMethod: form.paymentMethod, reference: form.reference || undefined,
    }),
    onSuccess: () => { toast.success('Payment recorded'); qc.invalidateQueries({ queryKey: ['vendor-payments'] }); qc.invalidateQueries({ queryKey: ['vendor-invoices'] }); setOpen(false); setForm({ vendorInvoiceId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'BANK_TRANSFER', reference: '' }) },
    onError: () => toast.error('Failed to record payment'),
  })

  const columns = [
    { key: 'vendorInvoice', header: 'Invoice', render: (r: Payment) => `${r.vendorInvoice.invoiceNumber} — ${r.vendorInvoice.vendor.name}` },
    { key: 'amount', header: 'Amount', render: (r: Payment) => formatCurrency(r.amount) },
    { key: 'paymentDate', header: 'Date', render: (r: Payment) => formatDate(r.paymentDate) },
    { key: 'paymentMethod', header: 'Method' },
    { key: 'reference', header: 'Reference', render: (r: Payment) => r.reference ?? '—' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Vendor Payments" description="Record payments against vendor invoices" actions={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Record Payment</Button>} />
      <DataTable columns={columns} data={payments} error={paymentsError} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Invoice *</Label>
              <Select value={form.vendorInvoiceId} onValueChange={v => setForm(f => ({ ...f, vendorInvoiceId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {invoices.filter(inv => Number(inv.totalAmount) > Number(inv.paidAmount)).map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.invoiceNumber} — {inv.vendor.name} (due: {formatCurrency(Number(inv.totalAmount) - Number(inv.paidAmount))})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Method *</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reference</Label>
              <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Cheque number / transaction ID" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.vendorInvoiceId || !form.amount || createMutation.isPending}>{createMutation.isPending ? 'Saving…' : 'Record Payment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
