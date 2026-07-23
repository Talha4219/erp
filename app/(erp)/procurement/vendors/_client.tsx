'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api-client'
import { vendorSchema, type VendorInput } from '@/lib/validations/procurement'
import type { Resolver } from 'react-hook-form'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type Vendor = { id: string; vendorCode: string; name: string; contactPerson: string | null; email: string | null; phone: string | null; city: string | null; country: string | null; isActive: boolean }

function vendorToForm(v: Vendor): Partial<VendorInput> {
  return { vendorCode: v.vendorCode, name: v.name, contactPerson: v.contactPerson ?? undefined, email: v.email ?? undefined, phone: v.phone ?? undefined, city: v.city ?? undefined, country: v.country ?? undefined }
}

export function PageClient({ initialData }: { initialData: Vendor[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<Vendor[]>('/api/procurement/vendors').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })

  const filtered = (data ?? []).filter((v) => {
    if (search) {
      const q = search.toLowerCase()
      if (!v.name.toLowerCase().includes(q) && !v.vendorCode.toLowerCase().includes(q) && !(v.email ?? '').toLowerCase().includes(q)) return false
    }
    return !filterStatus || (filterStatus === 'active' ? v.isActive : !v.isActive)
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<VendorInput>({
    resolver: zodResolver(vendorSchema) as unknown as Resolver<VendorInput>,
  })

  const mutation = useMutation({
    mutationFn: (data: VendorInput) =>
      editing ? api.put(`/api/procurement/vendors/${editing.id}`, data) : api.post('/api/procurement/vendors', data),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['vendors'] })
      const previous = qc.getQueryData(['vendors'])
      qc.setQueryData(['vendors'], (old: any[]) =>
        editing
          ? old.map((item) => (item.id === editing.id ? { ...item, ...newData } : item))
          : [{ ...newData, id: 'temp-' + Date.now(), isActive: true }, ...(old ?? [])]
      )
      return { previous }
    },
    onSuccess: () => { toast.success(editing ? 'Vendor updated' : 'Vendor created') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['vendors'], context.previous); toast.error('Failed to save vendor') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); setShowForm(false); reset({} as VendorInput); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/procurement/vendors/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['vendors'] })
      const previous = qc.getQueryData(['vendors'])
      qc.setQueryData(['vendors'], (old: any[]) => old.filter((item) => item.id !== id))
      return { previous }
    },
    onSuccess: () => { toast.success('Vendor disabled') },
    onError: (err, id, context) => { if (context?.previous) qc.setQueryData(['vendors'], context.previous); toast.error('Failed to disable') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); setDeleteId(null) },
  })

  const columns = [
    { key: 'vendorCode', header: 'Code', sortable: true },
    { key: 'name', header: 'Vendor Name', sortable: true },
    { key: 'email', header: 'Email', render: (r: Vendor) => r.email ?? '-' },
    { key: 'phone', header: 'Phone', render: (r: Vendor) => r.phone ?? '-' },
    { key: 'city', header: 'City', render: (r: Vendor) => r.city ?? '-' },
    { key: 'isActive', header: 'Status', render: (r: Vendor) => <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Manage vendor/supplier records"
        actions={
          <Button onClick={() => { setEditing(null); reset(); setShowForm(true) }}>
            <Plus className="mr-2 h-4 w-4" />Add Vendor
          </Button>
        }
      />

      <div className="flex gap-3 flex-wrap mb-2">
        <Input placeholder="Search name, code or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterStatus) && <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterStatus('') }}>Clear</Button>}
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading} error={error}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/procurement/vendors/${row.id}`}><Eye className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setEditing(row); reset(vendorToForm(row)); setShowForm(true) }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setEditing(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'vendorCode', label: 'Vendor Code' },
                { name: 'name', label: 'Vendor Name' },
                { name: 'contactPerson', label: 'Contact Person' },
                { name: 'email', label: 'Email', type: 'email' },
                { name: 'phone', label: 'Phone' },
                { name: 'address', label: 'Address' },
                { name: 'city', label: 'City' },
                { name: 'country', label: 'Country' },
                { name: 'taxId', label: 'Tax ID' },
              ].map(({ name, label, type }) => (
                <div key={name} className="space-y-1">
                  <Label>{label}</Label>
                  <Input {...register(name as keyof VendorInput)} type={type} />
                  {errors[name as keyof typeof errors] && (
                    <p className="text-xs text-red-500">{(errors[name as keyof typeof errors] as { message?: string })?.message}</p>
                  )}
                </div>
              ))}
              <div className="space-y-1">
                <Label>Payment Terms (days)</Label>
                <Input {...register('paymentTerms', { valueAsNumber: true })} type="number" min="0" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Disable Vendor"
        description="Are you sure you want to disable this vendor?"
      />
    </div>
  )
}
