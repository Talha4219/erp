'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft, Plus, Building2, User, Mail, Phone, FileClock, Award,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const INVOICE_VARIANT: Record<string, 'success'|'destructive'|'warning'|'info'|'secondary'> = {
  PAID: 'success', OVERDUE: 'destructive', PARTIALLY_PAID: 'warning', SENT: 'info', DRAFT: 'secondary', CANCELLED: 'secondary',
}
const ORDER_VARIANT: Record<string, 'success'|'destructive'|'warning'|'info'|'secondary'> = {
  DELIVERED: 'success', CANCELLED: 'destructive', SHIPPED: 'info', PACKED: 'info', PICKING: 'warning',
  CREDIT_HOLD: 'destructive', RESERVED: 'warning', PENDING_PO: 'warning', CONFIRMED: 'info', DRAFT: 'secondary',
}
const RETURN_VARIANT: Record<string, 'warning'|'success'|'destructive'|'info'|'secondary'> = {
  PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', COMPLETED: 'info',
}
const QUOTATION_VARIANT: Record<string, 'success'|'destructive'|'warning'|'info'|'secondary'> = {
  ACCEPTED: 'success', REJECTED: 'destructive', EXPIRED: 'secondary', SENT: 'info', DRAFT: 'secondary',
}

type Contact = { id: string; firstName: string; lastName: string; jobTitle: string | null; department: string | null; email: string | null; phone: string | null }
type Quotation = { id: string; quotationNumber: string; quotationDate: string; totalAmount: number; status: string }
type Order = { id: string; soNumber: string; orderDate: string; totalAmount: number; status: string }
type Payment = { id: string; amount: number; paymentDate: string; method: string; reference: string | null; invoiceNumber: string }
type Invoice = { id: string; invoiceNumber: string; invoiceDate: string; dueDate: string; totalAmount: number; paidAmount: number; status: string; payments: Payment[] }
type ReturnRow = { id: string; returnNumber: string; returnDate: string; reason: string; status: string; totalAmount: number }
type Rating = { id: string; ratedByName: string; overallScore: number; paymentScore: number; businessScore: number; relationshipScore: number; notes: string | null; ratedAt: string }
type Opportunity = { id: string; title: string; stage: string; createdAt: string; lead: { firstName: string; lastName: string; createdAt: string } | null }
type Document = { id: string; title: string; category: string; fileName: string; createdAt: string }

type CustomerDetail = {
  id: string; customerCode: string; name: string; contactPerson: string | null; email: string | null; phone: string | null
  address: string | null; city: string | null; country: string | null; taxId: string | null
  creditLimit: number | null; paymentTerms: number; isActive: boolean
  contacts: Contact[]; quotations: Quotation[]; salesOrders: Order[]; invoices: Invoice[]
  returns: ReturnRow[]; ratings: Rating[]; opportunities: Opportunity[]; documents: Document[]
  totalRevenue: number; outstandingAmount: number; openOrders: number; lastPurchase: string | null
  paymentHistory: Payment[]
}

function gradeOf(score: number) {
  if (score >= 90) return { label: 'A+', cls: 'text-emerald-600' }
  if (score >= 80) return { label: 'A', cls: 'text-emerald-600' }
  if (score >= 70) return { label: 'B', cls: 'text-amber-600' }
  return { label: 'C', cls: 'text-red-600' }
}

export function PageClient({ id, initialData }: { id: string; initialData: CustomerDetail }) {
  const qc = useQueryClient()
  const [showRating, setShowRating] = useState(false)
  const [ratingForm, setRatingForm] = useState({ ratedByName: '', overallScore: '80', paymentScore: '80', businessScore: '80', relationshipScore: '80', notes: '' })

  const { data: c, isLoading } = useQuery({
    queryKey: ['customer-detail', id],
    queryFn: () => api.get<CustomerDetail>(`/api/sales/customers/${id}`).then(r => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const rateMutation = useMutation({
    mutationFn: () => api.post('/api/sales/customer-ratings', { customerId: id, ...ratingForm }),
    onSuccess: () => { toast.success('Rating recorded'); qc.invalidateQueries({ queryKey: ['customer-detail', id] }); setShowRating(false) },
    onError: () => toast.error('Failed'),
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (!c) return <div className="p-6 text-muted-foreground">Customer not found.</div>

  const avgScore = c.ratings.length ? c.ratings.reduce((s, r) => s + r.overallScore, 0) / c.ratings.length : null
  const grade = avgScore !== null ? gradeOf(avgScore) : null

  // Cross-module timeline: Lead -> Opportunity -> Quotation -> Order -> Invoice -> Payment -> Return
  const timeline = [
    ...c.opportunities.flatMap(o => [
      ...(o.lead ? [{ label: `Lead Created — ${o.lead.firstName} ${o.lead.lastName}`, date: o.lead.createdAt }] : []),
      { label: `Opportunity — ${o.title} (${o.stage.replace(/_/g, ' ')})`, date: o.createdAt },
    ]),
    ...c.quotations.map(q => ({ label: `Quotation Sent — ${q.quotationNumber}`, date: q.quotationDate })),
    ...c.salesOrders.map(o => ({ label: `Order Received — ${o.soNumber}`, date: o.orderDate })),
    ...c.invoices.map(i => ({ label: `Invoice Created — ${i.invoiceNumber}`, date: i.invoiceDate })),
    ...c.paymentHistory.map(p => ({ label: `Payment Received — ${formatCurrency(Number(p.amount))} (${p.invoiceNumber})`, date: p.paymentDate })),
    ...c.returns.map(r => ({ label: `Return — ${r.returnNumber} (${r.reason})`, date: r.returnDate })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        description={`${c.customerCode} · ${[c.city, c.country].filter(Boolean).join(', ')}`}
        actions={
          <div className="flex gap-2">
            {grade && <Badge variant="outline" className={cn('font-bold', grade.cls)}>{grade.label} Customer</Badge>}
            <Badge variant={c.isActive ? 'success' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
            <Button variant="outline" asChild><Link href="/sales/customers"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
          </div>
        }
      />

      {/* 360 summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Total Revenue</p><p className="mt-1 text-lg font-bold text-emerald-700">{formatCurrency(c.totalRevenue)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Outstanding</p><p className="mt-1 text-lg font-bold text-red-600">{formatCurrency(c.outstandingAmount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Open Orders</p><p className="mt-1 text-lg font-bold">{c.openOrders}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Last Purchase</p><p className="mt-1 text-lg font-bold">{c.lastPurchase ? formatDate(c.lastPurchase) : '—'}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Credit Limit</p><p className="mt-1 text-lg font-bold">{c.creditLimit ? formatCurrency(Number(c.creditLimit)) : '—'}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1"><Award className="h-3 w-3" />Rating</p><p className="mt-1 text-lg font-bold">{avgScore ? `${avgScore.toFixed(0)}/100` : '—'}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({c.contacts.length})</TabsTrigger>
          <TabsTrigger value="quotations">Quotations ({c.quotations.length})</TabsTrigger>
          <TabsTrigger value="orders">Orders ({c.salesOrders.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({c.invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({c.paymentHistory.length})</TabsTrigger>
          <TabsTrigger value="returns">Returns ({c.returns.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({c.documents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { icon: Building2, label: 'Customer Code', value: c.customerCode },
                  { icon: Mail, label: 'Email', value: c.email },
                  { icon: Phone, label: 'Phone', value: c.phone },
                  { icon: User, label: 'Contact Person', value: c.contactPerson },
                ].map(({ icon: Icon, label, value }) => value ? (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div><span className="text-muted-foreground">{label}: </span>{value}</div>
                  </div>
                ) : null)}
                {c.address && <div className="text-muted-foreground text-xs pt-1">{c.address}{c.city ? `, ${c.city}` : ''}{c.country ? `, ${c.country}` : ''}</div>}
                <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Payment Terms</span><span>Net {c.paymentTerms} days</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax ID</span><span>{c.taxId ?? '—'}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Rating</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowRating(true)}><Plus className="mr-1 h-3.5 w-3.5" />Rate</Button>
              </CardHeader>
              <CardContent>
                {c.ratings.length === 0 ? <p className="text-sm text-muted-foreground">No ratings yet.</p> : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: 'Overall', avg: c.ratings.reduce((s,r)=>s+r.overallScore,0)/c.ratings.length },
                      { label: 'Payment', avg: c.ratings.reduce((s,r)=>s+r.paymentScore,0)/c.ratings.length },
                      { label: 'Business', avg: c.ratings.reduce((s,r)=>s+r.businessScore,0)/c.ratings.length },
                      { label: 'Relationship', avg: c.ratings.reduce((s,r)=>s+r.relationshipScore,0)/c.ratings.length },
                    ].map(({ label, avg }) => (
                      <div key={label} className="text-center">
                        <p className="text-xs text-muted-foreground uppercase font-medium mb-1">{label}</p>
                        <p className="text-xl font-bold">{avg.toFixed(0)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileClock className="h-4 w-4" />Sales Timeline</CardTitle></CardHeader>
            <CardContent>
              {timeline.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
                <div className="space-y-4">
                  {timeline.map((t, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                        {i < timeline.length - 1 && <div className="mt-1 h-full w-px flex-1 bg-border" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card><CardContent className="pt-4">
            {c.contacts.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No contacts yet.</p> : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {c.contacts.map(ct => (
                  <Card key={ct.id}><CardContent className="pt-4 space-y-1.5">
                    <p className="font-semibold text-sm">{ct.firstName} {ct.lastName}</p>
                    {ct.jobTitle && <p className="text-xs text-muted-foreground">{ct.jobTitle}{ct.department ? ` · ${ct.department}` : ''}</p>}
                    {ct.email && <div className="flex items-center gap-1.5 text-xs"><Mail className="h-3 w-3 text-muted-foreground" />{ct.email}</div>}
                    {ct.phone && <div className="flex items-center gap-1.5 text-xs"><Phone className="h-3 w-3 text-muted-foreground" />{ct.phone}</div>}
                  </CardContent></Card>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="quotations">
          <Card><CardContent className="pt-4">
            {c.quotations.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No quotations yet.</p> : (
              <table className="w-full text-sm"><thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="pb-2 text-left">Quotation #</th><th className="pb-2 text-left">Date</th><th className="pb-2 text-right">Amount</th><th className="pb-2 text-center">Status</th></tr></thead>
              <tbody className="divide-y">{c.quotations.map(q => (
                <tr key={q.id}>
                  <td className="py-2"><Link href={`/sales/quotations/${q.id}`} className="text-primary hover:underline">{q.quotationNumber}</Link></td>
                  <td className="py-2 text-muted-foreground">{formatDate(q.quotationDate)}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(Number(q.totalAmount))}</td>
                  <td className="py-2 text-center"><Badge variant={QUOTATION_VARIANT[q.status] ?? 'secondary'}>{q.status}</Badge></td>
                </tr>
              ))}</tbody></table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card><CardContent className="pt-4">
            {c.salesOrders.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No orders yet.</p> : (
              <table className="w-full text-sm"><thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="pb-2 text-left">Order #</th><th className="pb-2 text-left">Date</th><th className="pb-2 text-right">Amount</th><th className="pb-2 text-center">Status</th></tr></thead>
              <tbody className="divide-y">{c.salesOrders.map(o => (
                <tr key={o.id}>
                  <td className="py-2"><Link href={`/sales/orders/${o.id}`} className="text-primary hover:underline">{o.soNumber}</Link></td>
                  <td className="py-2 text-muted-foreground">{formatDate(o.orderDate)}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(Number(o.totalAmount))}</td>
                  <td className="py-2 text-center"><Badge variant={ORDER_VARIANT[o.status] ?? 'secondary'}>{o.status.replace(/_/g,' ')}</Badge></td>
                </tr>
              ))}</tbody></table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card><CardContent className="pt-4">
            {c.invoices.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No invoices yet.</p> : (
              <table className="w-full text-sm"><thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="pb-2 text-left">Invoice #</th><th className="pb-2 text-left">Date</th><th className="pb-2 text-left">Due</th><th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Paid</th><th className="pb-2 text-center">Status</th></tr></thead>
              <tbody className="divide-y">{c.invoices.map(i => (
                <tr key={i.id}>
                  <td className="py-2"><Link href={`/sales/invoices/${i.id}`} className="text-primary hover:underline">{i.invoiceNumber}</Link></td>
                  <td className="py-2 text-muted-foreground">{formatDate(i.invoiceDate)}</td>
                  <td className="py-2 text-muted-foreground">{formatDate(i.dueDate)}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(Number(i.totalAmount))}</td>
                  <td className="py-2 text-right text-emerald-700">{formatCurrency(Number(i.paidAmount))}</td>
                  <td className="py-2 text-center"><Badge variant={INVOICE_VARIANT[i.status] ?? 'secondary'}>{i.status.replace(/_/g,' ')}</Badge></td>
                </tr>
              ))}</tbody></table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card><CardContent className="pt-4">
            {c.paymentHistory.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No payments yet.</p> : (
              <table className="w-full text-sm"><thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="pb-2 text-left">Date</th><th className="pb-2 text-left">Invoice</th><th className="pb-2 text-left">Method</th><th className="pb-2 text-left">Reference</th><th className="pb-2 text-right">Amount</th></tr></thead>
              <tbody className="divide-y">{c.paymentHistory.map(p => (
                <tr key={p.id}>
                  <td className="py-2 text-muted-foreground">{formatDate(p.paymentDate)}</td>
                  <td className="py-2">{p.invoiceNumber}</td>
                  <td className="py-2">{p.method.replace(/_/g,' ')}</td>
                  <td className="py-2">{p.reference ?? '—'}</td>
                  <td className="py-2 text-right font-semibold">{formatCurrency(Number(p.amount))}</td>
                </tr>
              ))}</tbody></table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="returns">
          <Card><CardContent className="pt-4">
            {c.returns.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No returns yet.</p> : (
              <table className="w-full text-sm"><thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="pb-2 text-left">Return #</th><th className="pb-2 text-left">Date</th><th className="pb-2 text-left">Reason</th><th className="pb-2 text-right">Amount</th><th className="pb-2 text-center">Status</th></tr></thead>
              <tbody className="divide-y">{c.returns.map(r => (
                <tr key={r.id}>
                  <td className="py-2"><Link href={`/sales/returns/${r.id}`} className="text-primary hover:underline">{r.returnNumber}</Link></td>
                  <td className="py-2 text-muted-foreground">{formatDate(r.returnDate)}</td>
                  <td className="py-2">{r.reason}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(Number(r.totalAmount))}</td>
                  <td className="py-2 text-center"><Badge variant={RETURN_VARIANT[r.status] ?? 'secondary'}>{r.status}</Badge></td>
                </tr>
              ))}</tbody></table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card><CardContent className="pt-4">
            {c.documents.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No documents on file.</p> : (
              <div className="space-y-2">{c.documents.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div><p className="font-medium">{d.title}</p><p className="text-xs text-muted-foreground">{d.category} · {d.fileName}</p></div>
                  <span className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</span>
                </div>
              ))}</div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showRating} onOpenChange={setShowRating}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Rate Customer</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label>Rated By *</Label><Input value={ratingForm.ratedByName} onChange={e => setRatingForm(p => ({ ...p, ratedByName: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Overall (0-100)</Label><Input type="number" min="0" max="100" value={ratingForm.overallScore} onChange={e => setRatingForm(p => ({ ...p, overallScore: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Payment Behavior</Label><Input type="number" min="0" max="100" value={ratingForm.paymentScore} onChange={e => setRatingForm(p => ({ ...p, paymentScore: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Business Contribution</Label><Input type="number" min="0" max="100" value={ratingForm.businessScore} onChange={e => setRatingForm(p => ({ ...p, businessScore: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Relationship</Label><Input type="number" min="0" max="100" value={ratingForm.relationshipScore} onChange={e => setRatingForm(p => ({ ...p, relationshipScore: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Notes</Label><Input value={ratingForm.notes} onChange={e => setRatingForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRating(false)}>Cancel</Button>
            <Button onClick={() => rateMutation.mutate()} disabled={rateMutation.isPending || !ratingForm.ratedByName}>{rateMutation.isPending ? 'Saving…' : 'Save Rating'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
