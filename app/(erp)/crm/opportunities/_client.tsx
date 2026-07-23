'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CrudListPage } from '@/components/shared/CrudListPage'
import { api } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Eye } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type Opp = { id: string; title: string; stage: string; probability: number; value: number; expectedClose: string | null; contact: { firstName: string; lastName: string } | null; customer: { name: string } | null }
type Customer = { id: string; name: string }

const STAGES = ['PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']
const STAGE_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'secondary'> = { CLOSED_WON: 'success', CLOSED_LOST: 'destructive', NEGOTIATION: 'warning', PROPOSAL: 'info', QUALIFICATION: 'info', PROSPECTING: 'secondary' }

export function OpportunitiesClient({ initialData }: { initialData: Opp[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', stage: 'PROSPECTING', probability: '0', value: '0', customerId: '', expectedClose: '', notes: '' })

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => api.get<Customer[]>('/api/sales/customers').then((r) => r.data ?? []), placeholderData: (previousData) => previousData })

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/crm/opportunities', { ...form, probability: Number(form.probability), value: Number(form.value), customerId: form.customerId || undefined, expectedClose: form.expectedClose || undefined }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['crm-opps'] })
      const previous = qc.getQueryData<Opp[]>(['crm-opps'])
      const customer = customers.find((c) => c.id === form.customerId)
      const temp: Opp = { id: `temp-${Date.now()}`, title: form.title, stage: form.stage, probability: Number(form.probability), value: Number(form.value), expectedClose: form.expectedClose || null, contact: null, customer: customer ?? null }
      qc.setQueryData<Opp[]>(['crm-opps'], (old) => [temp, ...(old ?? [])])
      return { previous }
    },
    onSuccess: () => { toast.success('Opportunity created'); setShowForm(false) },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['crm-opps'], context.previous)
      toast.error('Failed to save')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm-opps'] }),
  })

  return (
    <>
      <CrudListPage<Opp>
        title="Opportunities"
        description="Track sales opportunities"
        queryKey={['crm-opps']}
        apiEndpoint="/api/crm/opportunities"
        initialData={initialData}
        searchPlaceholder="Search…"
        searchFields={['title', 'customer.name']}
        filters={[{ key: 'stage', label: 'Stage', options: STAGES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) }]}
        columns={[
          { key: 'title', header: 'Title', sortable: true },
          { key: 'customer', header: 'Company', render: (r: Opp) => r.customer?.name ?? (r.contact ? `${r.contact.firstName} ${r.contact.lastName}` : '—') },
          { key: 'value', header: 'Value', render: (r: Opp) => formatCurrency(Number(r.value)) },
          { key: 'probability', header: 'Prob %', render: (r: Opp) => `${r.probability}%` },
          { key: 'stage', header: 'Stage', render: (r: Opp) => <Badge variant={STAGE_VARIANT[r.stage] ?? 'secondary'}>{r.stage.replace(/_/g, ' ')}</Badge> },
        ]}
        actions={(row) => <Button variant="ghost" size="icon" asChild><Link href={`/crm/opportunities/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>}
        addButtonLabel="New Opportunity"
        addButtonAction={() => setShowForm(true)}
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Opportunity</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm((p) => ({ ...p, stage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Company</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm((p) => ({ ...p, customerId: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent><SelectItem value="">None</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Value (£)</Label>
              <Input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Probability %</Label>
              <Input type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm((p) => ({ ...p, probability: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Expected Close</Label>
              <Input type="date" value={form.expectedClose} onChange={(e) => setForm((p) => ({ ...p, expectedClose: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.title}>{createMutation.isPending ? 'Saving…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
