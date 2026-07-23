'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { CrudListPage } from '@/components/shared/CrudListPage'
import type { Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Star } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Rating = {
  id: string; vendorId: string; ratedByName: string; overallScore: number; qualityScore: number
  deliveryScore: number; priceScore: number; notes: string | null; ratedAt: string
  vendor: { name: string; vendorCode: string }
}

type Vendor = { id: string; name: string; vendorCode: string }

type RatingFormData = {
  vendorId: string
  ratedByName: string
  overallScore: string
  qualityScore: string
  deliveryScore: string
  priceScore: string
  notes: string
}

const emptyForm: RatingFormData = {
  vendorId: '', ratedByName: '', overallScore: '5',
  qualityScore: '5', deliveryScore: '5', priceScore: '5', notes: ''
}

function StarDisplay({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= score ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{score}/5</span>
    </div>
  )
}

function StarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange(String(i))}>
          <Star className={`h-5 w-5 ${i <= Number(value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  )
}

function SupplierRatingForm({ editing, onSave: onSaveForm, onCancel, isPending }: { editing: any; onSave: (data: any) => void; onCancel: () => void; isPending: boolean }) {
  const [form, setForm] = useState<RatingFormData>(() => {
    if (editing) {
      return {
        vendorId: editing.vendorId,
        ratedByName: editing.ratedByName,
        overallScore: String(editing.overallScore),
        qualityScore: String(editing.qualityScore),
        deliveryScore: String(editing.deliveryScore),
        priceScore: String(editing.priceScore),
        notes: editing.notes ?? '',
      }
    }
    return { ...emptyForm }
  })

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<Vendor[]>('/api/procurement/vendors').then(r => r.data ?? []),
    staleTime: 60_000,
  })

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Supplier *</Label>
        <Select value={form.vendorId} onValueChange={(v) => setForm(p => ({ ...p, vendorId: v }))}>
          <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
          <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Rated By *</Label>
        <Input value={form.ratedByName} onChange={(e) => setForm(p => ({ ...p, ratedByName: e.target.value }))} placeholder="Your name" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { key: 'overallScore', label: 'Overall Score' },
          { key: 'qualityScore', label: 'Quality Score' },
          { key: 'deliveryScore', label: 'Delivery Score' },
          { key: 'priceScore', label: 'Price Score' },
        ].map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label>{label}</Label>
            <StarPicker value={(form as Record<string, string>)[key]} onChange={(v) => setForm(p => ({ ...p, [key]: v }))} />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label>Notes</Label>
        <Input value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional feedback…" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button onClick={() => onSaveForm(form)} disabled={isPending || !form.vendorId || !form.ratedByName}>
          {isPending ? 'Saving…' : editing ? 'Update' : 'Submit Rating'}
        </Button>
      </div>
    </div>
  )
}

export function SupplierRatingsClient({ initialData }: { initialData: Rating[] }) {
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<Vendor[]>('/api/procurement/vendors').then(r => r.data ?? []),
  })
  const { data: allRatings = [] } = useQuery({
    queryKey: ['supplier-ratings'],
    queryFn: () => api.get<Rating[]>('/api/procurement/supplier-ratings').then(r => r.data ?? []),
    initialData,
    staleTime: 30_000,
  })

  const vendorOptions = vendors.map(v => ({ value: v.id, label: v.name }))

  const vendorAverages = Object.values(
    allRatings.reduce<Record<string, { name: string; scores: number[]; count: number }>>((acc, r) => {
      if (!acc[r.vendorId]) acc[r.vendorId] = { name: r.vendor.name, scores: [], count: 0 }
      acc[r.vendorId].scores.push(r.overallScore)
      acc[r.vendorId].count++
      return acc
    }, {})
  ).map(v => ({ name: v.name, avg: v.scores.reduce((a, b) => a + b, 0) / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)

  const columns: Column<Rating>[] = [
    { key: 'vendor', header: 'Supplier', render: (r) => r.vendor.name, sortable: true },
    { key: 'overall', header: 'Overall', render: (r) => <StarDisplay score={r.overallScore} /> },
    { key: 'quality', header: 'Quality', render: (r) => <StarDisplay score={r.qualityScore} /> },
    { key: 'delivery', header: 'Delivery', render: (r) => <StarDisplay score={r.deliveryScore} /> },
    { key: 'price', header: 'Price', render: (r) => <StarDisplay score={r.priceScore} /> },
    { key: 'ratedByName', header: 'Rated By' },
    { key: 'ratedAt', header: 'Date', render: (r) => formatDate(r.ratedAt) },
    { key: 'notes', header: 'Notes', render: (r) => r.notes ?? '—' },
  ]

  return (
    <div className="space-y-6">
      {vendorAverages.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {vendorAverages.map(v => (
            <div key={v.name} className="rounded-lg border bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground truncate">{v.name}</p>
              <div className="mt-1 flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <span className="text-lg font-bold">{v.avg.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({v.count})</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <CrudListPage<Rating>
        title="Supplier Ratings"
        description="Track and manage supplier performance scores"
        queryKey={['supplier-ratings']}
        apiEndpoint="/api/procurement/supplier-ratings"
        initialData={initialData}
        columns={columns}
        filters={[{ key: 'vendorId', label: 'Supplier', options: vendorOptions }]}
        addButtonLabel="Add Rating"
        onSave={async (data, id) => {
          const payload = {
            ...data,
            overallScore: Number(data.overallScore),
            qualityScore: Number(data.qualityScore),
            deliveryScore: Number(data.deliveryScore),
            priceScore: Number(data.priceScore),
          }
          if (id) return api.patch(`/api/procurement/supplier-ratings/${id}`, payload)
          return api.post('/api/procurement/supplier-ratings', payload)
        }}
        onDelete={async (id) => api.delete(`/api/procurement/supplier-ratings/${id}`)}
        formTitle={(editing) => editing ? 'Edit Supplier Rating' : 'Add Supplier Rating'}
        FormComponent={SupplierRatingForm}
      />
    </div>
  )
}
