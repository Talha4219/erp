'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api-client'
import { customerSchema, type CustomerInput } from '@/lib/validations/sales'
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
import { ExcelImport, type ImportResult } from '@/components/shared/ExcelImport'
import { Plus, Pencil, Trash2, X, Upload, Eye } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type Customer = { id: string; customerCode: string; name: string; contactPerson: string | null; email: string | null; phone: string | null; city: string | null; country: string | null; isActive: boolean }

function customerToForm(c: Customer): Partial<CustomerInput> {
  return {
    customerCode: c.customerCode, name: c.name, contactPerson: c.contactPerson ?? undefined,
    email: c.email ?? undefined, phone: c.phone ?? undefined, city: c.city ?? undefined, country: c.country ?? undefined,
  }
}

export function PageClient({ initialData }: { initialData: Customer[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/api/sales/customers').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((c) => {
    if (search) {
      const q = search.toLowerCase()
      if (!c.name.toLowerCase().includes(q) && !c.customerCode.toLowerCase().includes(q) && !(c.email ?? '').toLowerCase().includes(q)) return false
    }
    if (filterStatus === 'active' && !c.isActive) return false
    if (filterStatus === 'inactive' && c.isActive) return false
    return true
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema) as unknown as Resolver<CustomerInput>,
  })

  const mutation = useMutation({
    mutationFn: (data: CustomerInput) =>
      editing ? api.put(`/api/sales/customers/${editing.id}`, data) : api.post('/api/sales/customers', data),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['customers'] })
      const previous = qc.getQueryData(['customers'])
      qc.setQueryData(['customers'], (old: any[]) =>
        editing
          ? old.map((item) => (item.id === editing.id ? { ...item, ...newData } : item))
          : [{ ...newData, id: 'temp-' + Date.now(), isActive: true }, ...(old ?? [])]
      )
      return { previous }
    },
    onSuccess: () => { toast.success(editing ? 'Customer updated' : 'Customer created') },
    onError: (err, _newData, context) => { if (context?.previous) qc.setQueryData(['customers'], context.previous); toast.error('Failed to save customer') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); reset(); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/sales/customers/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['customers'] })
      const previous = qc.getQueryData(['customers'])
      qc.setQueryData(['customers'], (old: any[]) => old.filter((item) => item.id !== id))
      return { previous }
    },
    onSuccess: () => { toast.success('Customer disabled') },
    onError: (err, id, context) => { if (context?.previous) qc.setQueryData(['customers'], context.previous); toast.error('Failed to disable') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setDeleteId(null) },
  })

  const columns = [
    { key: 'customerCode', header: 'Code', sortable: true },
    { key: 'name', header: 'Customer Name', sortable: true },
    { key: 'email', header: 'Email', render: (r: Customer) => r.email ?? '-' },
    { key: 'phone', header: 'Phone', render: (r: Customer) => r.phone ?? '-' },
    { key: 'city', header: 'City', render: (r: Customer) => r.city ?? '-' },
    { key: 'isActive', header: 'Status', render: (r: Customer) => <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Manage customer records"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)}><Upload className="mr-2 h-4 w-4" />Import Excel</Button>
            <Button onClick={() => { setEditing(null); reset(); setShowForm(true) }}><Plus className="mr-2 h-4 w-4" />Add Customer</Button>
          </div>
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
        {(search || filterStatus) && (
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterStatus('') }}>
            <X className="h-4 w-4 mr-1" />Clear
          </Button>
        )}
      </div>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} error={error}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild><Link href={`/sales/customers/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
            <Button variant="ghost" size="icon" onClick={() => { setEditing(row); reset(customerToForm(row)); setShowForm(true) }}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      />
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setEditing(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'customerCode', label: 'Customer Code' }, { name: 'name', label: 'Customer Name' },
                { name: 'contactPerson', label: 'Contact Person' }, { name: 'email', label: 'Email', type: 'email' },
                { name: 'phone', label: 'Phone' }, { name: 'address', label: 'Address' },
                { name: 'city', label: 'City' }, { name: 'country', label: 'Country' },
                { name: 'taxId', label: 'Tax ID' },
              ].map(({ name, label, type }) => (
                <div key={name} className="space-y-1">
                  <Label>{label}</Label>
                  <Input {...register(name as keyof CustomerInput)} type={type} />
                  {errors[name as keyof typeof errors] && (
                    <p className="text-xs text-red-500">{(errors[name as keyof typeof errors] as { message?: string })?.message}</p>
                  )}
                </div>
              ))}
              <div className="space-y-1"><Label>Credit Limit</Label><Input {...register('creditLimit', { valueAsNumber: true })} type="number" min="0" step="0.01" /></div>
              <div className="space-y-1"><Label>Payment Terms (days)</Label><Input {...register('paymentTerms', { valueAsNumber: true })} type="number" min="0" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ExcelImport open={showImport} onClose={() => setShowImport(false)} templateName="Customers"
        templateHeaders={['Customer Code','Customer Name','Contact Person','Email','Phone','Address','City','Country','Tax ID','Credit Limit','Payment Terms (Days)']}
        sampleRows={[{'Customer Code':'CUST001','Customer Name':'ERP Ltd','Contact Person':'Jane Doe','Email':'jane@acme.com','Phone':'02079460000','Address':'1 Trade St','City':'London','Country':'UK','Tax ID':'GB123456789','Credit Limit':'5000','Payment Terms (Days)':'30'}]}
        onImport={async (rows) => { const res = await api.post<ImportResult>('/api/sales/customers/import', { rows }); return res.data ?? { success: 0, failed: rows.length, errors: ['Unknown error'] } }}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['customers'] })}
      />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Disable Customer" description="Are you sure?" />
    </div>
  )
}
