'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Phone, Mail, MapPin, Gift, Eye, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type RetailCustomer = { id: number; title: string | null; firstName: string; lastName: string; email: string; phone: string | null; loyaltyPointsBalance: number; marketingOptIn: boolean; gdprConsentDate: string | null; dataRetentionConsent: boolean; isAnonymised: boolean; createdAt: string; addresses: Array<{ id: number; addressLine1: string; city: string; postcode: string; isPrimary: boolean }> }

export function PageClient({ initialData }: { initialData: RetailCustomer[] }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<RetailCustomer | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['retail-customers'],
    queryFn: () => api.get<RetailCustomer[]>('/api/retail/customers').then((r) => r.data ?? []),
    initialData,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filtered = (data ?? []).filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${c.firstName} ${c.lastName} ${c.email} ${c.phone ?? ''}`.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Retail Customers" description="POS / e-commerce customers" />
      <div className="flex gap-3">
        <Input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        {search && <Button variant="outline" size="sm" onClick={() => setSearch('')}><X className="h-4 w-4 mr-1" />Clear</Button>}
      </div>
      <DataTable
        columns={[
          { key: 'name', header: 'Name', sortable: true, render: (r: RetailCustomer) => `${r.firstName} ${r.lastName}` },
          { key: 'email', header: 'Email' },
          { key: 'phone', header: 'Phone', render: (r: RetailCustomer) => r.phone ?? '—' },
          { key: 'loyaltyPointsBalance', header: 'Loyalty Points', render: (r: RetailCustomer) => <Badge variant="secondary">{r.loyaltyPointsBalance}</Badge> },
          { key: 'marketingOptIn', header: 'Marketing', render: (r: RetailCustomer) => r.marketingOptIn ? <Badge variant="success">Opted In</Badge> : <Badge variant="outline">Opted Out</Badge> },
          { key: 'createdAt', header: 'Since', render: (r: RetailCustomer) => formatDate(r.createdAt) },
        ]}
        data={filtered} isLoading={isLoading} error={error}
        actions={(row) => <Button variant="ghost" size="icon" onClick={() => setSelected(row)}><Eye className="h-4 w-4" /></Button>}
      />
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selected?.firstName} {selected?.lastName}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{selected.email}</div>
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{selected.phone ?? '—'}</div>
                <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-muted-foreground" />{selected.loyaltyPointsBalance} points</div>
                <div>
                  <Badge variant={selected.marketingOptIn ? 'success' : 'outline'}>{selected.marketingOptIn ? 'Marketing Opted In' : 'Marketing Opted Out'}</Badge>
                </div>
              </div>
              {selected.addresses.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Addresses</h4>
                  <div className="space-y-2">
                    {selected.addresses.map((addr) => (
                      <div key={addr.id} className="flex items-start gap-2 text-sm text-muted-foreground border rounded-md p-2">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{addr.addressLine1}, {addr.city}, {addr.postcode}{addr.isPrimary ? ' (Primary)' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Customer since {formatDate(selected.createdAt)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
