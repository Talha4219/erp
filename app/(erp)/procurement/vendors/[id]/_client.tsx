'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ArrowLeft, Plus, Star, Phone, Mail, Building2, User, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type Contact = { id: string; firstName: string; lastName: string; jobTitle: string | null; department: string | null; email: string | null; phone: string | null; mobile: string | null; isPrimary: boolean; notes: string | null }
type Rating = { id: string; ratedByName: string; overallScore: number; qualityScore: number; deliveryScore: number; priceScore: number; notes: string | null; ratedAt: string }
type PORef = { id: string; poNumber: string; status: string; grandTotal: number; orderDate: string; deliveryDate: string | null }
type VendorDetail = {
  id: string; vendorCode: string; name: string; contactPerson: string | null; email: string | null; phone: string | null
  address: string | null; city: string | null; country: string | null; taxId: string | null; paymentTerms: number; creditLimit: number | null; isActive: boolean
  contacts: Contact[]; ratings: Rating[]; purchaseOrders: PORef[]
}

const PO_VARIANT: Record<string, 'secondary' | 'warning' | 'info' | 'success' | 'destructive'> = {
  DRAFT: 'secondary', PENDING_APPROVAL: 'warning', APPROVED: 'info',
  PARTIALLY_RECEIVED: 'warning', FULLY_RECEIVED: 'success', CANCELLED: 'destructive',
}

function Stars({ score }: { score: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} className={`h-3.5 w-3.5 ${n <= score ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </span>
  )
}

export function PageClient({ id, initialData }: { id: string; initialData: VendorDetail }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'profile' | 'orders' | 'contacts' | 'ratings'>('profile')
  const [showContact, setShowContact] = useState(false)
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', jobTitle: '', department: '', email: '', phone: '', mobile: '', isPrimary: false, notes: '' })

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => api.get<VendorDetail>(`/api/procurement/vendors/${id}`).then(r => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const addContactMutation = useMutation({
    mutationFn: () => api.post('/api/procurement/supplier-contacts', { vendorId: id, ...contactForm }),
    onSuccess: () => { toast.success('Contact added'); qc.invalidateQueries({ queryKey: ['vendor', id] }); setShowContact(false); setContactForm({ firstName: '', lastName: '', jobTitle: '', department: '', email: '', phone: '', mobile: '', isPrimary: false, notes: '' }) },
    onError: () => toast.error('Failed'),
  })

  const deleteContactMutation = useMutation({
    mutationFn: (cid: string) => api.delete(`/api/procurement/supplier-contacts/${cid}`),
    onSuccess: () => { toast.success('Contact removed'); qc.invalidateQueries({ queryKey: ['vendor', id] }) },
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (!vendor) return <div className="p-6 text-muted-foreground">Vendor not found.</div>

  const avgRating = vendor.ratings.length ? (vendor.ratings.reduce((s, r) => s + r.overallScore, 0) / vendor.ratings.length).toFixed(1) : null
  const totalSpend = vendor.purchaseOrders.filter(p => p.status !== 'CANCELLED').reduce((s, p) => s + Number(p.grandTotal), 0)

  const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'orders', label: `Purchase Orders (${vendor.purchaseOrders.length})` },
    { key: 'contacts', label: `Contacts (${vendor.contacts.length})` },
    { key: 'ratings', label: `Ratings (${vendor.ratings.length})` },
  ] as const

  return (
    <div className="space-y-6">
      <PageHeader
        title={vendor.name}
        description={`${vendor.vendorCode} · ${vendor.city ?? ''} ${vendor.country ?? ''}`.trim()}
        actions={
          <div className="flex gap-2">
            <Badge variant={vendor.isActive ? 'success' : 'secondary'} className="self-center">{vendor.isActive ? 'Active' : 'Inactive'}</Badge>
            <Button variant="outline" asChild>
              <Link href="/procurement/vendors"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase font-medium">Total POs</p>
          <p className="mt-1 text-xl font-bold">{vendor.purchaseOrders.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase font-medium">Total Spend</p>
          <p className="mt-1 text-xl font-bold text-green-700">{formatCurrency(totalSpend)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase font-medium">Avg Rating</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xl font-bold">{avgRating ?? '—'}</p>
            {avgRating && <Stars score={Math.round(Number(avgRating))} />}
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase font-medium">Payment Terms</p>
          <p className="mt-1 text-xl font-bold">Net {vendor.paymentTerms}</p>
        </CardContent></Card>
      </div>

      <div className="flex gap-2 border-b">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { icon: Building2, label: 'Vendor Code', value: vendor.vendorCode },
                { icon: Mail, label: 'Email', value: vendor.email },
                { icon: Phone, label: 'Phone', value: vendor.phone },
                { icon: User, label: 'Contact Person', value: vendor.contactPerson },
              ].map(({ icon: Icon, label, value }) => value ? (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div><span className="text-muted-foreground">{label}: </span>{value}</div>
                </div>
              ) : null)}
              {vendor.address && <div className="text-muted-foreground text-xs pt-1">{vendor.address}{vendor.city ? `, ${vendor.city}` : ''}{vendor.country ? `, ${vendor.country}` : ''}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Financial Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tax ID</span><span>{vendor.taxId ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payment Terms</span><span>Net {vendor.paymentTerms} days</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Credit Limit</span><span>{vendor.creditLimit ? formatCurrency(Number(vendor.creditLimit)) : '—'}</span></div>
              <div className="flex justify-between border-t pt-2 font-semibold"><span>Total Spend (all time)</span><span className="text-green-700">{formatCurrency(totalSpend)}</span></div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'orders' && (
        <Card>
          <CardHeader><CardTitle>Purchase Order History</CardTitle></CardHeader>
          <CardContent>
            {vendor.purchaseOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No purchase orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="pb-2 text-left">PO #</th>
                      <th className="pb-2 text-left">Order Date</th>
                      <th className="pb-2 text-left">Delivery Date</th>
                      <th className="pb-2 text-right">Value</th>
                      <th className="pb-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vendor.purchaseOrders.map(po => (
                      <tr key={po.id}>
                        <td className="py-2">
                          <Link href={`/procurement/purchase-orders/${po.id}`} className="text-primary hover:underline">{po.poNumber}</Link>
                        </td>
                        <td className="py-2 text-muted-foreground">{formatDate(po.orderDate)}</td>
                        <td className="py-2 text-muted-foreground">{po.deliveryDate ? formatDate(po.deliveryDate) : '—'}</td>
                        <td className="py-2 text-right font-medium">{formatCurrency(Number(po.grandTotal))}</td>
                        <td className="py-2 text-center">
                          <Badge variant={PO_VARIANT[po.status] ?? 'secondary'} className="text-xs">{po.status.replace(/_/g,' ')}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowContact(true)}><Plus className="mr-2 h-4 w-4" />Add Contact</Button>
          </div>
          {vendor.contacts.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No contacts yet.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vendor.contacts.map(c => (
                <Card key={c.id} className={c.isPrimary ? 'border-primary/40 bg-primary/5' : ''}>
                  <CardContent className="pt-4 space-y-1.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{c.firstName} {c.lastName}</p>
                        {c.isPrimary && <Badge variant="info" className="text-xs mt-0.5">Primary</Badge>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteContactMutation.mutate(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {c.jobTitle && <p className="text-xs text-muted-foreground">{c.jobTitle}{c.department ? ` · ${c.department}` : ''}</p>}
                    {c.email && <div className="flex items-center gap-1.5 text-xs"><Mail className="h-3 w-3 text-muted-foreground" /><a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a></div>}
                    {c.phone && <div className="flex items-center gap-1.5 text-xs"><Phone className="h-3 w-3 text-muted-foreground" />{c.phone}</div>}
                    {c.mobile && <div className="flex items-center gap-1.5 text-xs"><Phone className="h-3 w-3 text-muted-foreground" />{c.mobile} <span className="text-muted-foreground">(mobile)</span></div>}
                    {c.notes && <p className="text-xs text-muted-foreground border-t pt-1.5 mt-1.5">{c.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'ratings' && (
        <div className="space-y-4">
          {vendor.ratings.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No ratings yet. <Link href="/procurement/supplier-ratings" className="text-primary hover:underline">Add one.</Link></CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle>Average Scores</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: 'Overall', avg: vendor.ratings.reduce((s,r)=>s+r.overallScore,0)/vendor.ratings.length },
                      { label: 'Quality', avg: vendor.ratings.reduce((s,r)=>s+r.qualityScore,0)/vendor.ratings.length },
                      { label: 'Delivery', avg: vendor.ratings.reduce((s,r)=>s+r.deliveryScore,0)/vendor.ratings.length },
                      { label: 'Price', avg: vendor.ratings.reduce((s,r)=>s+r.priceScore,0)/vendor.ratings.length },
                    ].map(({ label, avg }) => (
                      <div key={label} className="text-center">
                        <p className="text-xs text-muted-foreground uppercase font-medium mb-1">{label}</p>
                        <p className="text-2xl font-bold">{avg.toFixed(1)}</p>
                        <Stars score={Math.round(avg)} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Rating History</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="pb-2 text-left">Date</th>
                        <th className="pb-2 text-left">Rated By</th>
                        <th className="pb-2 text-center">Overall</th>
                        <th className="pb-2 text-center">Quality</th>
                        <th className="pb-2 text-center">Delivery</th>
                        <th className="pb-2 text-center">Price</th>
                        <th className="pb-2 text-left">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {vendor.ratings.map(r => (
                        <tr key={r.id}>
                          <td className="py-2 text-muted-foreground">{formatDate(r.ratedAt)}</td>
                          <td className="py-2">{r.ratedByName}</td>
                          <td className="py-2 text-center"><Stars score={r.overallScore} /></td>
                          <td className="py-2 text-center"><Stars score={r.qualityScore} /></td>
                          <td className="py-2 text-center"><Stars score={r.deliveryScore} /></td>
                          <td className="py-2 text-center"><Stars score={r.priceScore} /></td>
                          <td className="py-2 text-xs text-muted-foreground max-w-xs truncate">{r.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      <Dialog open={showContact} onOpenChange={setShowContact}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>First Name *</Label><Input value={contactForm.firstName} onChange={e => setContactForm(p => ({ ...p, firstName: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Last Name *</Label><Input value={contactForm.lastName} onChange={e => setContactForm(p => ({ ...p, lastName: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Job Title</Label><Input value={contactForm.jobTitle} onChange={e => setContactForm(p => ({ ...p, jobTitle: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Department</Label><Input value={contactForm.department} onChange={e => setContactForm(p => ({ ...p, department: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Mobile</Label><Input value={contactForm.mobile} onChange={e => setContactForm(p => ({ ...p, mobile: e.target.value }))} /></div>
            <div className="space-y-1 flex items-end gap-2 pb-0.5">
              <input type="checkbox" id="primary" checked={contactForm.isPrimary} onChange={e => setContactForm(p => ({ ...p, isPrimary: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="primary" className="cursor-pointer">Primary contact</Label>
            </div>
            <div className="col-span-2 space-y-1"><Label>Notes</Label><Input value={contactForm.notes} onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContact(false)}>Cancel</Button>
            <Button onClick={() => addContactMutation.mutate()} disabled={addContactMutation.isPending || !contactForm.firstName || !contactForm.lastName}>
              {addContactMutation.isPending ? 'Adding…' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
