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
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

type PR = { id: string; returnNumber: string; status: string; returnDate: string; reason: string; totalAmount: number; vendor: { name: string }; grn: { grnNumber: string } | null; invoice: { invoiceNumber: string } | null }
type Vendor = { id: string; name: string }
type GRNSummary = { id: string; grnNumber: string; po: { vendor: { name: string }; lineItems: Array<{ id: string; description: string }> }; lineItems: Array<{ id: string; poLineItemId: string | null; itemId: string | null; acceptedQty: number; unitPrice: number; warehouseId: string | null }> }
type GRNListRow = { id: string; grnNumber: string; po: { vendor: { name: string } } }

const R_STATUS: Record<string, { label: string; variant: 'secondary'|'warning'|'success'|'destructive' }> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  APPROVED: { label: 'Approved', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
}

export function PageClient({ initialReturns, initialVendors, initialGrnsList }: { initialReturns: PR[]; initialVendors: Vendor[]; initialGrnsList: GRNListRow[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formStep, setFormStep] = useState<'select' | 'items' | 'review'>('select')
  const [selVendor, setSelVendor] = useState('')
  const [selGrn, setSelGrn] = useState('')
  const [reason, setReason] = useState('')
  const [returnItems, setReturnItems] = useState<Array<{ grnItemId: string; description: string; qty: number }>>([])

  const { data: returns = [], error: returnsError } = useQuery({
    queryKey: ['proc-returns'],
    queryFn: () => api.get<PR[]>('/api/procurement/returns').then(r => r.data ?? []),
    initialData: initialReturns,
    staleTime: 30_000,
  })

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<Vendor[]>('/api/procurement/vendors').then(r => r.data ?? []),
    initialData: initialVendors,
    staleTime: 30_000,
  })

  const { data: grnsList = [] } = useQuery({
    queryKey: ['grns-list'],
    queryFn: () => api.get<GRNListRow[]>('/api/procurement/grns').then(r => r.data ?? []),
    initialData: initialGrnsList,
    staleTime: 30_000,
  })

  const { data: grnDetail } = useQuery({
    queryKey: ['grn-detail', selGrn],
    queryFn: () => selGrn ? api.get<GRNSummary>(`/api/procurement/grns/${selGrn}`).then(r => r.data!) : Promise.resolve(undefined),
    enabled: !!selGrn,
  })

  const filteredGrns = grnsList.filter(g => selVendor ? g.po.vendor.name === vendors.find(v => v.id === selVendor)?.name : true)

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/procurement/returns', {
      grnId: selGrn, reason, returnItems: returnItems.filter(i => i.qty > 0).map(i => ({ grnItemId: i.grnItemId, quantity: i.qty })),
    }),
    onSuccess: () => { toast.success('Return created'); qc.invalidateQueries({ queryKey: ['proc-returns'] }); setShowForm(false); setFormStep('select'); setSelVendor(''); setSelGrn(''); setReason(''); setReturnItems([]) },
    onError: () => toast.error('Failed to create return'),
  })

  const columns = [
    { key: 'returnNumber', header: 'Return #', sortable: true },
    { key: 'vendor', header: 'Vendor', render: (r: PR) => r.vendor.name },
    { key: 'returnDate', header: 'Date', render: (r: PR) => formatDate(r.returnDate) },
    { key: 'reason', header: 'Reason' },
    { key: 'totalAmount', header: 'Total', render: (r: PR) => formatCurrency(r.totalAmount) },
    { key: 'status', header: 'Status', render: (r: PR) => { const c = R_STATUS[r.status]; return c ? <Badge variant={c.variant}>{c.label}</Badge> : <Badge>{r.status}</Badge> } },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Returns" description="Return defective or incorrect items to vendors" actions={<Button onClick={() => { setFormStep('select'); setSelVendor(''); setSelGrn(''); setReason(''); setReturnItems([]); setShowForm(true) }}><Plus className="mr-2 h-4 w-4" />New Return</Button>} />
      <DataTable columns={columns} data={returns} error={returnsError} />
      <Dialog open={showForm} onOpenChange={o => { if (!o) { setShowForm(false); setFormStep('select') } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Purchase Return</DialogTitle></DialogHeader>
          {formStep === 'select' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Vendor</Label>
                <Select value={selVendor} onValueChange={v => { setSelVendor(v); setSelGrn('') }}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>GRN (Goods Receipt) *</Label>
                <Select value={selGrn} onValueChange={v => { setSelGrn(v); setReturnItems([]) }}>
                  <SelectTrigger><SelectValue placeholder="Select GRN" /></SelectTrigger>
                  <SelectContent>{filteredGrns.map(g => <SelectItem key={g.id} value={g.id}>{g.grnNumber} — {g.po.vendor.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reason *</Label>
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Damaged, wrong item, expired" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button disabled={!selGrn || !reason.trim()} onClick={() => { if (grnDetail) setReturnItems(grnDetail.lineItems.map(li => ({ grnItemId: li.id, description: li.poLineItemId ? (grnDetail.po.lineItems.find(pli => pli.id === li.poLineItemId)?.description ?? 'Item') : 'Item', qty: 0 }))); setFormStep('items') }}>Next: Select Items →</Button>
              </DialogFooter>
            </div>
          )}
          {formStep === 'items' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select quantities to return from GRN {grnDetail?.grnNumber}</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {returnItems.map((ri, i) => (
                  <div key={ri.grnItemId} className="flex items-center gap-2">
                    <span className="flex-1 text-sm truncate">{ri.description}</span>
                    <Input type="number" min="0" step="0.001" value={ri.qty || ''} onChange={e => setReturnItems(prev => prev.map((r, j) => j === i ? { ...r, qty: Number(e.target.value) } : r))} className="w-20 h-8 text-xs" placeholder="0" />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFormStep('select')}>← Back</Button>
                <Button disabled={!returnItems.some(r => r.qty > 0) || createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending ? 'Creating…' : 'Create Return'}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
