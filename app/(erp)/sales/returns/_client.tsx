'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Eye, Plus } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type Return = { id: string; returnNumber: string; status: string; returnDate: string; reason: string; totalAmount: number; customer: { name: string }; invoice: { invoiceNumber: string }; creditNote: { creditNoteNumber: string; status: string } | null }
type Invoice = { id: string; invoiceNumber: string; customerId: string; customer: { name: string } }
type InvoiceItem = { id: string; itemId: string | null; description: string; quantity: number; unitPrice: number }
type InvoiceDetail = { id: string; lineItems: InvoiceItem[] }
type Warehouse = { id: string; name: string }
type ReturnRow = { itemId: string | null; description: string; unitPrice: number; maxQty: number; returnQty: string }

const STATUS_VARIANT: Record<string, 'warning'|'success'|'destructive'|'info'|'secondary'> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', COMPLETED: 'info' }
const REASONS = ['Defective', 'Wrong Item', 'Not As Described', 'Change of Mind', 'Damaged in Transit', 'Other']

export function PageClient({ initialData }: { initialData: Return[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ invoiceId: '', customerId: '', returnDate: '', reason: '', notes: '', warehouseId: '' })
  const [rows, setRows] = useState<ReturnRow[]>([])

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-returns'],
    queryFn: () => api.get<Return[]>('/api/sales/returns').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices-list'], queryFn: () => api.get<Invoice[]>('/api/sales/invoices').then((r) => r.data ?? []), placeholderData: (prev) => prev })
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses-list'], queryFn: () => api.get<Warehouse[]>('/api/inventory/warehouses').then((r) => r.data ?? []), placeholderData: (prev) => prev })
  const { data: invoiceDetail } = useQuery({
    queryKey: ['invoice-for-return', form.invoiceId],
    queryFn: () => api.get<InvoiceDetail>(`/api/sales/invoices/${form.invoiceId}`).then((r) => r.data!),
    enabled: !!form.invoiceId,
  })

  const selectedInvoice = invoices.find((i) => i.id === form.invoiceId)

  function selectInvoice(id: string) {
    setForm((p) => ({ ...p, invoiceId: id }))
    setRows([])
  }

  if (invoiceDetail && invoiceDetail.id === form.invoiceId && rows.length === 0 && invoiceDetail.lineItems.length > 0) {
    setRows(invoiceDetail.lineItems.map((li) => ({
      itemId: li.itemId, description: li.description, unitPrice: Number(li.unitPrice), maxQty: Number(li.quantity), returnQty: String(li.quantity),
    })))
  }

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/sales/returns', {
      ...form,
      customerId: selectedInvoice?.customerId,
      lineItems: rows.filter((r) => Number(r.returnQty) > 0).map((r) => ({
        itemId: r.itemId || undefined, warehouseId: form.warehouseId || undefined,
        description: r.description, quantity: Number(r.returnQty), unitPrice: r.unitPrice,
        totalPrice: Number(r.returnQty) * r.unitPrice,
      })),
    }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['sales-returns'] })
      const previous = qc.getQueryData(['sales-returns'])
      qc.setQueryData(['sales-returns'], (old: any[]) => [{ ...form, id: 'temp-' + Date.now(), status: 'PENDING', returnNumber: '...', customer: { name: selectedInvoice?.customer?.name ?? '' }, invoice: { invoiceNumber: selectedInvoice?.invoiceNumber ?? '' }, totalAmount: 0, creditNote: null }, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Return created') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['sales-returns'], context.previous); toast.error('Failed to create') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['sales-returns'] }); setShowForm(false); setForm({ invoiceId: '', customerId: '', returnDate: '', reason: '', notes: '', warehouseId: '' }); setRows([]) },
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Returns" description="Manage customer sales returns" actions={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />New Return</Button>} />
      <DataTable
        columns={[
          { key: 'returnNumber', header: 'Return #', sortable: true },
          { key: 'invoice', header: 'Invoice', render: (r: Return) => r.invoice.invoiceNumber },
          { key: 'customer', header: 'Customer', render: (r: Return) => r.customer.name },
          { key: 'returnDate', header: 'Return Date', render: (r: Return) => formatDate(r.returnDate) },
          { key: 'reason', header: 'Reason' },
          { key: 'totalAmount', header: 'Amount', render: (r: Return) => formatCurrency(Number(r.totalAmount)) },
          { key: 'status', header: 'Status', render: (r: Return) => <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status}</Badge> },
          { key: 'creditNote', header: 'Credit Note', render: (r: Return) => r.creditNote ? <span className="text-xs text-green-700 font-medium">{r.creditNote.creditNoteNumber}</span> : <span className="text-xs text-muted-foreground">—</span> },
        ]}
        data={data} isLoading={isLoading} error={error}
        actions={(row) => <Button variant="ghost" size="icon" asChild><Link href={`/sales/returns/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Return</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Invoice *</Label>
              <Select value={form.invoiceId} onValueChange={selectInvoice}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>{invoices.map((i) => <SelectItem key={i.id} value={i.id}>{i.invoiceNumber} — {i.customer.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Return Date *</Label><Input type="date" value={form.returnDate} onChange={(e) => setForm((p) => ({ ...p, returnDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Reason *</Label>
              <Select value={form.reason} onValueChange={(v) => setForm((p) => ({ ...p, reason: v }))}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Restock Warehouse</Label>
              <Select value={form.warehouseId} onValueChange={(v) => setForm((p) => ({ ...p, warehouseId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          {rows.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <Label>Items to Return</Label>
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{r.description}</span>
                  <Input type="number" min="0" max={r.maxQty} step="any" value={r.returnQty}
                    onChange={(e) => setRows((p) => p.map((row, j) => j === i ? { ...row, returnQty: e.target.value } : row))}
                    className="h-8 w-20 text-xs" />
                  <span className="text-xs text-muted-foreground w-16">of {r.maxQty}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.invoiceId || !form.returnDate || !form.reason}>{createMutation.isPending ? 'Creating…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
