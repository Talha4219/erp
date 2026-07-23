'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { CrudListPage } from '@/components/shared/CrudListPage'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'

type Contact = {
  id: string
  firstName: string
  lastName: string
  jobTitle: string | null
  department: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  isPrimary: boolean
  vendor: { id: string; name: string; vendorCode: string }
}

const emptyForm = { vendorId: '', firstName: '', lastName: '', jobTitle: '', department: '', email: '', phone: '', mobile: '', isPrimary: false, notes: '' }

function SupplierContactForm({ editing, onSave: onSaveForm, onCancel, isPending }: { editing: any; onSave: (data: any) => void; onCancel: () => void; isPending: boolean }) {
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<{ id: string; name: string; vendorCode: string }[]>('/api/procurement/vendors').then(r => r.data ?? []),
  })

  const [form, setForm] = useState(() => {
    if (editing) {
      return {
        vendorId: (editing as any).vendorId ?? editing.vendor?.id ?? '',
        firstName: editing.firstName,
        lastName: editing.lastName,
        jobTitle: editing.jobTitle ?? '',
        department: editing.department ?? '',
        email: editing.email ?? '',
        phone: editing.phone ?? '',
        mobile: editing.mobile ?? '',
        isPrimary: editing.isPrimary,
        notes: '',
      }
    }
    return { ...emptyForm }
  })

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1">
        <Label>Supplier *</Label>
        <Select value={form.vendorId} onValueChange={(v) => setForm(p => ({ ...p, vendorId: v }))}>
          <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
          <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>First Name *</Label><Input value={form.firstName} onChange={(e) => setForm(p => ({ ...p, firstName: e.target.value }))} /></div>
      <div className="space-y-1"><Label>Last Name *</Label><Input value={form.lastName} onChange={(e) => setForm(p => ({ ...p, lastName: e.target.value }))} /></div>
      <div className="space-y-1"><Label>Job Title</Label><Input value={form.jobTitle} onChange={(e) => setForm(p => ({ ...p, jobTitle: e.target.value }))} /></div>
      <div className="space-y-1"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm(p => ({ ...p, department: e.target.value }))} /></div>
      <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} /></div>
      <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
      <div className="space-y-1"><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm(p => ({ ...p, mobile: e.target.value }))} /></div>
      <div className="flex items-center gap-2 pt-5">
        <input type="checkbox" id="isPrimary" checked={form.isPrimary} onChange={(e) => setForm(p => ({ ...p, isPrimary: e.target.checked }))} className="h-4 w-4" />
        <Label htmlFor="isPrimary" className="cursor-pointer font-normal">Primary contact</Label>
      </div>
      <div className="col-span-2 space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
      <div className="col-span-2 flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button onClick={() => onSaveForm(form)} disabled={isPending || !form.vendorId || !form.firstName || !form.lastName}>
          {isPending ? 'Saving…' : editing ? 'Update' : 'Create'}
        </Button>
      </div>
    </div>
  )
}

export function SupplierContactsClient({ initialData }: { initialData: Contact[] }) {
  const columns: Column<Contact>[] = [
    {
      key: 'name', header: 'Name', render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{r.firstName} {r.lastName}</span>
          {r.isPrimary && <Badge variant="info" className="text-xs">Primary</Badge>}
        </div>
      ),
    },
    {
      key: 'vendor', header: 'Supplier', render: (r) => (
        <Link href={`/procurement/vendors/${r.vendor.id}`} className="text-primary hover:underline flex items-center gap-1">
          {r.vendor.name} <ExternalLink className="h-3 w-3" />
        </Link>
      ),
    },
    { key: 'jobTitle', header: 'Role', render: (r) => r.jobTitle ? `${r.jobTitle}${r.department ? ` · ${r.department}` : ''}` : '—' },
    { key: 'email', header: 'Email', render: (r) => r.email ? <a href={`mailto:${r.email}`} className="text-primary hover:underline">{r.email}</a> : '—' },
    { key: 'phone', header: 'Phone', render: (r) => r.phone ?? r.mobile ?? '—' },
  ]

  return (
    <CrudListPage<Contact>
      title="Supplier Contacts"
      description="Manage contact persons across all suppliers"
      queryKey={['supplier-contacts']}
      apiEndpoint="/api/procurement/supplier-contacts"
      initialData={initialData}
      columns={columns}
      addButtonLabel="Add Contact"
      filterFn={(item, search) => {
        if (!search) return null
        const combined = `${item.firstName} ${item.lastName} ${item.email ?? ''} ${item.vendor.name}`.toLowerCase()
        return combined.includes(search.toLowerCase())
      }}
      onSave={async (data, id) => {
        if (id) return api.patch(`/api/procurement/supplier-contacts/${id}`, data)
        return api.post('/api/procurement/supplier-contacts', data)
      }}
      onDelete={async (id) => api.delete(`/api/procurement/supplier-contacts/${id}`)}
      formTitle={(editing) => editing ? 'Edit Supplier Contact' : 'Add Supplier Contact'}
      FormComponent={SupplierContactForm}
    />
  )
}
