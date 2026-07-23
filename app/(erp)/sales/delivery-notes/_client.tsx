'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { CrudListPage } from '@/components/shared/CrudListPage'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DialogFooter } from '@/components/ui/dialog'
import { Eye } from 'lucide-react'
import Link from 'next/link'

type DN = { id: string; dnNumber: string; status: string; deliveryDate: string; carrier: string | null; trackingNumber: string | null; customer: { name: string }; so: { soNumber: string }; _count: { lineItems: number } }
type Order = { id: string; soNumber: string; customerId: string; customer: { name: string } }

const STATUS_VARIANT: Record<string, 'secondary'|'info'|'success'|'destructive'> = { DRAFT: 'secondary', DISPATCHED: 'info', DELIVERED: 'success', CANCELLED: 'destructive' }

const columns: Column<DN>[] = [
  { key: 'dnNumber', header: 'DN #', sortable: true },
  { key: 'so', header: 'Sales Order', render: (r) => r.so.soNumber },
  { key: 'customer', header: 'Customer', render: (r) => r.customer.name },
  { key: 'deliveryDate', header: 'Delivery Date', render: (r) => formatDate(r.deliveryDate) },
  { key: 'carrier', header: 'Carrier', render: (r) => r.carrier ?? '—' },
  { key: 'trackingNumber', header: 'Tracking', render: (r) => r.trackingNumber ?? '—' },
  { key: 'status', header: 'Status', render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status}</Badge> },
]

function DNForm({ onSave, onCancel, isPending }: {
  editing: DN | null
  onSave: (data: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState({ soId: '', deliveryDate: '', carrier: '', trackingNumber: '', notes: '' })
  const { data: orders = [] } = useQuery({
    queryKey: ['sales-orders-list'],
    queryFn: () => api.get<Order[]>('/api/sales/orders').then((r) => r.data ?? []),
  })

  const selectedOrder = orders.find((o) => o.id === form.soId)

  return (
    <div className="space-y-3">
      <div className="col-span-2 space-y-1"><Label>Sales Order *</Label>
        <Select value={form.soId} onValueChange={(v) => setForm((p) => ({ ...p, soId: v }))}>
          <SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger>
          <SelectContent>{orders.map((o) => <SelectItem key={o.id} value={o.id}>{o.soNumber} — {o.customer.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-1"><Label>Delivery Date *</Label><Input type="date" value={form.deliveryDate} onChange={(e) => setForm((p) => ({ ...p, deliveryDate: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Carrier</Label><Input value={form.carrier} onChange={(e) => setForm((p) => ({ ...p, carrier: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Tracking #</Label><Input value={form.trackingNumber} onChange={(e) => setForm((p) => ({ ...p, trackingNumber: e.target.value }))} /></div>
      </div>
      <div className="col-span-2 space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button onClick={() => onSave({ ...form, customerId: selectedOrder?.customerId })} disabled={isPending || !form.soId || !form.deliveryDate}>
          {isPending ? 'Creating…' : 'Create'}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function PageClient({ initialData }: { initialData: DN[] }) {
  return (
    <CrudListPage<DN>
      title="Delivery Notes"
      description="Track shipments and deliveries"
      queryKey={['delivery-notes']}
      apiEndpoint="/api/sales/delivery-notes"
      initialData={initialData}
      columns={columns}
      addButtonLabel="New Delivery Note"
      actions={(row) => <Button variant="ghost" size="icon" asChild><Link href={`/sales/delivery-notes/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>}
      onSave={async (formData, id) => {
        if (id) await api.patch(`/api/sales/delivery-notes/${id}`, formData)
        else await api.post('/api/sales/delivery-notes', formData)
      }}
      FormComponent={DNForm}
      formTitle="New Delivery Note"
    />
  )
}
