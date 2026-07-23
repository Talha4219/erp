'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CrudListPage } from '@/components/shared/CrudListPage'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DialogFooter } from '@/components/ui/dialog'

type CN = { id: string; creditNoteNumber: string; status: string; issueDate: string; amount: number; appliedAmount: number; reason: string | null; customer: { name: string }; return: { returnNumber: string } | null }
type Customer = { id: string; name: string }

const STATUS_VARIANT: Record<string, 'secondary'|'info'|'success'|'destructive'> = { DRAFT: 'secondary', ISSUED: 'info', APPLIED: 'success', CANCELLED: 'destructive' }
const STATUSES = ['DRAFT', 'ISSUED', 'APPLIED', 'CANCELLED']

const columns: Column<CN>[] = [
  { key: 'creditNoteNumber', header: 'CN #', sortable: true },
  { key: 'customer', header: 'Customer', render: (r) => r.customer.name },
  { key: 'return', header: 'Return Ref', render: (r) => r.return?.returnNumber ?? '—' },
  { key: 'issueDate', header: 'Issue Date', render: (r) => formatDate(r.issueDate) },
  { key: 'amount', header: 'Amount', render: (r) => formatCurrency(Number(r.amount)) },
  { key: 'appliedAmount', header: 'Applied', render: (r) => formatCurrency(Number(r.appliedAmount)) },
  { key: 'balance', header: 'Balance', render: (r) => formatCurrency(Number(r.amount) - Number(r.appliedAmount)) },
  { key: 'status', header: 'Status', render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status}</Badge> },
]

function CNForm({ editing, onSave, onCancel, isPending }: {
  editing: CN | null
  onSave: (data: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState({
    customerId: '',
    issueDate: editing?.issueDate?.slice(0, 10) ?? '',
    amount: editing?.amount ? String(editing.amount) : '',
    reason: editing?.reason ?? '',
    notes: '',
  })
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/api/sales/customers').then((r) => r.data ?? []),
  })

  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label>Customer *</Label>
        <Select value={form.customerId} onValueChange={(v) => setForm((p) => ({ ...p, customerId: v }))}>
          <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
          <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Issue Date *</Label><Input type="date" value={form.issueDate} onChange={(e) => setForm((p) => ({ ...p, issueDate: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Amount *</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></div>
      </div>
      <div className="space-y-1"><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} /></div>
      <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button onClick={() => onSave({ ...form, amount: Number(form.amount) })} disabled={isPending || !form.customerId || !form.amount}>
          {isPending ? 'Saving…' : editing ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function PageClient({ initialData }: { initialData: CN[] }) {
  const qc = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/api/sales/credit-notes/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['credit-notes'] })
      const previous = qc.getQueryData(['credit-notes'])
      qc.setQueryData(['credit-notes'], (old: any[]) => old.map((item: any) => item.id === id ? { ...item, status } : item))
      return { previous }
    },
    onError: (_err, _vars, context) => { if (context?.previous) qc.setQueryData(['credit-notes'], context.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['credit-notes'] }),
  })

  return (
    <CrudListPage<CN>
      title="Credit Notes"
      description="Manage customer credit notes"
      queryKey={['credit-notes']}
      apiEndpoint="/api/sales/credit-notes"
      initialData={initialData}
      columns={columns}
      addButtonLabel="New Credit Note"
      actions={(row) => (
        <Select value={row.status} onValueChange={(v) => statusMutation.mutate({ id: row.id, status: v })}>
          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
        </Select>
      )}
      onSave={async (formData, id) => {
        if (id) await api.patch(`/api/sales/credit-notes/${id}`, formData)
        else await api.post('/api/sales/credit-notes', formData)
      }}
      onDelete={async (id) => { await api.delete(`/api/sales/credit-notes/${id}`) }}
      FormComponent={CNForm}
      formTitle={(e) => e ? 'Edit Credit Note' : 'New Credit Note'}
    />
  )
}
