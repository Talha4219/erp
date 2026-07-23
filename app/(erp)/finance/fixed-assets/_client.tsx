'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Plus, Pencil, Trash2, TrendingDown, PackageX } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'

type Account = { id: string; code: string; name: string }
type FixedAsset = { id: string; assetCode: string; name: string; accountId: string; account: Account; purchaseDate: string; purchaseCost: number; residualValue: number; usefulLifeYears: number; depreciationMethod: string; status: string; accumulatedDepreciation: number; bookValue: number; location?: string; serialNumber?: string }

const STATUS_COLOR: Record<string, 'default' | 'secondary' | 'destructive'> = { ACTIVE: 'default', FULLY_DEPRECIATED: 'secondary', DISPOSED: 'destructive', TRANSFERRED: 'secondary' }

export function PageClient({ initialData }: { initialData: FixedAsset[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<FixedAsset | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [depreciateId, setDepreciateId] = useState<string | null>(null)
  const [disposeId, setDisposeId] = useState<string | null>(null)
  const [depPeriod, setDepPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [disposeForm, setDisposeForm] = useState({ disposalDate: '', disposalAmount: 0, disposalNotes: '' })
  const [form, setForm] = useState({ name: '', accountId: '', purchaseDate: '', purchaseCost: 0, residualValue: 0, usefulLifeYears: 5, depreciationMethod: 'STRAIGHT_LINE', location: '', serialNumber: '' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['fixed-assets'],
    queryFn: () => api.get<FixedAsset[]>('/api/finance/fixed-assets').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/api/finance/accounts').then((r) => r.data ?? []),
    placeholderData: (prev) => prev,
  })

  const saveMut = useMutation({
    mutationFn: (p: typeof form & { id?: string }) =>
      p.id ? api.put(`/api/finance/fixed-assets/${p.id}`, p) : api.post('/api/finance/fixed-assets', p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fixed-assets'] }); toast.success('Saved'); setShowForm(false); setEditing(null) },
    onError: (e: Error) => toast.error(e.message),
  })

  const depreciateMut = useMutation({
    mutationFn: ({ id, period }: { id: string; period: string }) => api.post(`/api/finance/fixed-assets/${id}/depreciate`, { period }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fixed-assets'] }); toast.success('Depreciation recorded'); setDepreciateId(null) },
    onError: (e: Error) => toast.error(e.message),
  })

  const disposeMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & typeof disposeForm) => api.post(`/api/finance/fixed-assets/${id}/dispose`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fixed-assets'] }); toast.success('Asset disposed'); setDisposeId(null) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/finance/fixed-assets/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fixed-assets'] }); toast.success('Deleted'); setDeleteId(null) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openEdit(a: FixedAsset) {
    setEditing(a)
    setForm({ name: a.name, accountId: a.accountId, purchaseDate: a.purchaseDate?.slice(0, 10) ?? '', purchaseCost: a.purchaseCost, residualValue: a.residualValue, usefulLifeYears: a.usefulLifeYears, depreciationMethod: a.depreciationMethod, location: a.location ?? '', serialNumber: a.serialNumber ?? '' })
    setShowForm(true)
  }

  const columns = [
    { key: 'assetCode', header: 'Code', render: (row: FixedAsset) => <span className="font-mono text-xs">{row.assetCode}</span> },
    { key: 'name', header: 'Asset Name' },
    { key: 'account', header: 'Account', render: (row: FixedAsset) => <span className="text-sm text-muted-foreground">{row.account?.name}</span> },
    { key: 'purchaseCost', header: 'Cost', render: (row: FixedAsset) => <span className="tabular-nums">{formatCurrency(row.purchaseCost)}</span> },
    { key: 'accumulatedDepreciation', header: 'Acc. Depn', render: (row: FixedAsset) => <span className="tabular-nums text-muted-foreground">{formatCurrency(row.accumulatedDepreciation)}</span> },
    { key: 'bookValue', header: 'Book Value', render: (row: FixedAsset) => <span className="tabular-nums font-semibold">{formatCurrency(row.bookValue)}</span> },
    { key: 'status', header: 'Status', render: (row: FixedAsset) => <Badge variant={STATUS_COLOR[row.status] ?? 'default'}>{row.status.replace('_', ' ')}</Badge> },
    {
      key: 'actions', header: '',
      render: (row: FixedAsset) => (
        <div className="flex gap-1 justify-end">
          {row.status === 'ACTIVE' && <Button size="sm" variant="ghost" title="Record depreciation" onClick={() => setDepreciateId(row.id)}><TrendingDown className="h-4 w-4" /></Button>}
          {row.status === 'ACTIVE' && <Button size="sm" variant="ghost" title="Dispose asset" onClick={() => { setDisposeId(row.id); setDisposeForm({ disposalDate: new Date().toISOString().slice(0, 10), disposalAmount: 0, disposalNotes: '' }) }}><PackageX className="h-4 w-4" /></Button>}
          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Fixed Assets" description="Asset register with depreciation and disposal tracking" actions={<Button onClick={() => { setEditing(null); setForm({ name: '', accountId: '', purchaseDate: '', purchaseCost: 0, residualValue: 0, usefulLifeYears: 5, depreciationMethod: 'STRAIGHT_LINE', location: '', serialNumber: '' }); setShowForm(true) }}><Plus className="h-4 w-4 mr-2" />Add Asset</Button>} />
      <DataTable columns={columns} data={data ?? []} isLoading={isLoading} error={error} />
      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Asset' : 'New Fixed Asset'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(editing ? { ...form, id: editing.id } : form) }} className="space-y-4">
            <div className="space-y-1"><Label>Asset Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
            <div className="space-y-1">
              <Label>Asset Account</Label>
              <Select value={form.accountId} onValueChange={(v) => setForm((f) => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{accounts.filter((a: Account & { type?: string }) => (a as { type?: string }).type === 'ASSET').map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Purchase Date</Label><Input type="date" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} required /></div>
              <div className="space-y-1"><Label>Purchase Cost (£)</Label><Input type="number" step="0.01" min="0" value={form.purchaseCost} onChange={(e) => setForm((f) => ({ ...f, purchaseCost: parseFloat(e.target.value) || 0 }))} required /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Residual (£)</Label><Input type="number" step="0.01" min="0" value={form.residualValue} onChange={(e) => setForm((f) => ({ ...f, residualValue: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="space-y-1"><Label>Useful Life (yrs)</Label><Input type="number" min="1" max="100" value={form.usefulLifeYears} onChange={(e) => setForm((f) => ({ ...f, usefulLifeYears: parseInt(e.target.value) || 5 }))} /></div>
              <div className="space-y-1">
                <Label>Method</Label>
                <Select value={form.depreciationMethod} onValueChange={(v) => setForm((f) => ({ ...f, depreciationMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="STRAIGHT_LINE">Straight Line</SelectItem><SelectItem value="DECLINING_BALANCE">Declining Balance</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Serial No.</Label><Input value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!depreciateId} onOpenChange={(o) => !o && setDepreciateId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Depreciation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Period (YYYY-MM)</Label><Input type="month" value={depPeriod} onChange={(e) => setDepPeriod(e.target.value)} /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDepreciateId(null)}>Cancel</Button>
              <Button disabled={depreciateMut.isPending} onClick={() => depreciateId && depreciateMut.mutate({ id: depreciateId, period: depPeriod })}>{depreciateMut.isPending ? 'Processing…' : 'Record Depreciation'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!disposeId} onOpenChange={(o) => !o && setDisposeId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dispose Asset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Disposal Date</Label><Input type="date" value={disposeForm.disposalDate} onChange={(e) => setDisposeForm((f) => ({ ...f, disposalDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Proceeds (£)</Label><Input type="number" step="0.01" min="0" value={disposeForm.disposalAmount} onChange={(e) => setDisposeForm((f) => ({ ...f, disposalAmount: parseFloat(e.target.value) || 0 }))} /></div>
            <div className="space-y-1"><Label>Notes</Label><Input value={disposeForm.disposalNotes} onChange={(e) => setDisposeForm((f) => ({ ...f, disposalNotes: e.target.value }))} /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisposeId(null)}>Cancel</Button>
              <Button variant="destructive" disabled={disposeMut.isPending} onClick={() => disposeId && disposeMut.mutate({ id: disposeId, ...disposeForm })}>{disposeMut.isPending ? 'Processing…' : 'Confirm Disposal'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Asset" description="Permanently delete this asset and all depreciation records?" onConfirm={() => deleteId && deleteMut.mutate(deleteId)} loading={deleteMut.isPending} />
    </div>
  )
}
