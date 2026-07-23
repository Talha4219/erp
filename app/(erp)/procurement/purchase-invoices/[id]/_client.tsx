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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft, Plus, CheckCircle2, Circle, Star,
  GitCompareArrows, Receipt, Clock, FileClock,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const STATUSES = ['DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED']
const METHODS = ['BANK_TRANSFER','CHEQUE','CASH','CARD','OTHER']
const STATUS_VARIANT: Record<string, 'secondary'|'info'|'warning'|'success'|'destructive'> = { DRAFT: 'secondary', SENT: 'info', PARTIALLY_PAID: 'warning', PAID: 'success', OVERDUE: 'destructive', CANCELLED: 'secondary' }
const WORKFLOW_STEPS = ['Invoice Received', 'Verification', 'Approval', 'AP Created', 'Payment', 'Closed']

type VIDetail = {
  id: string; invoiceNumber: string; status: string; matchingStatus: string
  invoiceDate: string; dueDate: string; createdAt: string
  subTotal: number; taxAmount: number; shippingCharges: number; discountAmount: number
  totalAmount: number; paidAmount: number; notes: string | null; financeNotes: string | null
  vendor: { name: string; email: string | null; creditLimit: number | null }
  vendorRating: number | null; vendorOutstandingBalance: number
  department: { name: string } | null; costCentre: { name: string } | null
  po: {
    poNumber: string; grandTotal: number
    grns: Array<{ id: string; grnNumber: string; lineItems: Array<{ acceptedQty: number; unitPrice: number }> }>
  } | null
  items: Array<{
    id: string; description: string; quantity: number; unitPrice: number; taxRate: number; discount: number; totalPrice: number
    item: { name: string; sku: string } | null; glAccount: { code: string; name: string } | null
    warehouse: { name: string } | null; costCentre: { name: string } | null; project: { name: string } | null
  }>
  payments: Array<{ id: string; amount: number; paymentDate: string; paymentMethod: string; reference: string | null }>
  journalEntries: Array<{
    id: string; entryNumber: string; date: string; description: string
    lines: Array<{ id: string; debitAmount: number; creditAmount: number; description: string | null
      debitAccount: { code: string; name: string } | null; creditAccount: { code: string; name: string } | null }>
  }>
}

const MATCHING_CFG: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pending Review', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  MATCHED: { label: 'Matched', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MISMATCH: { label: 'Mismatch', cls: 'bg-red-50 text-red-600 border-red-200' },
}

export function PageClient({ id, initialData }: { id: string; initialData: VIDetail }) {
  const qc = useQueryClient()
  const [showPayment, setShowPayment] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', paymentDate: '', paymentMethod: 'BANK_TRANSFER', reference: '' })

  const { data: inv, isLoading } = useQuery({ queryKey: ['vi', id], queryFn: () => api.get<VIDetail>(`/api/procurement/vendor-invoices/${id}`).then(r => r.data!), initialData, staleTime: 30_000 })
  const statusMutation = useMutation({ mutationFn: (status: string) => api.patch(`/api/procurement/vendor-invoices/${id}`, { status }), onSuccess: (res) => { toast.success('Updated'); if (res.success && res.data) qc.setQueryData(['vi', id], res.data); qc.invalidateQueries({ queryKey: ['vi', id] }) } })
  const payMutation = useMutation({
    mutationFn: () => api.post('/api/procurement/vendor-payments', { vendorInvoiceId: id, ...payForm, amount: Number(payForm.amount) }),
    onSuccess: () => { toast.success('Payment recorded'); qc.invalidateQueries({ queryKey: ['vi', id] }); setShowPayment(false) },
    onError: () => toast.error('Failed'),
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (!inv) return <div className="p-6 text-muted-foreground">Not found.</div>
  const balance = Number(inv.totalAmount) - Number(inv.paidAmount)

  const daysPastDue = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000)
  const agingColor = inv.status === 'PAID' || inv.status === 'CANCELLED' ? 'text-muted-foreground'
    : daysPastDue > 0 ? 'text-red-600' : daysPastDue > -7 ? 'text-amber-600' : 'text-emerald-600'
  const agingLabel = inv.status === 'PAID' ? 'Settled' : daysPastDue > 0 ? `${daysPastDue}d overdue` : `${-daysPastDue}d until due`

  const workflowStepIndex = (() => {
    if (inv.status === 'PAID') return 6
    if (Number(inv.paidAmount) > 0) return 5
    if (inv.journalEntries.length > 0) return 4
    if (inv.status !== 'DRAFT') return 3
    if (inv.matchingStatus !== 'PENDING') return 2
    return 1
  })()

  const activity = [
    { label: 'Invoice Received', date: inv.createdAt },
    ...(inv.matchingStatus !== 'PENDING' ? [{ label: `Matching ${inv.matchingStatus === 'MATCHED' ? 'Completed' : 'Flagged'}`, date: inv.createdAt }] : []),
    ...inv.journalEntries.map(j => ({ label: j.description, date: j.date })),
    ...inv.payments.map(p => ({ label: `Payment recorded — ${formatCurrency(Number(p.amount))}`, date: p.paymentDate })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="space-y-6">
      <PageHeader title={inv.invoiceNumber} description={inv.vendor.name} actions={<Button variant="outline" asChild><Link href="/procurement/purchase-invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Status</p><div className="mt-2"><Badge variant={STATUS_VARIANT[inv.status] ?? 'secondary'}>{inv.status.replace(/_/g,' ')}</Badge></div></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Total</p><p className="mt-1 text-lg font-bold">{formatCurrency(Number(inv.totalAmount))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Paid</p><p className="mt-1 font-semibold text-green-600">{formatCurrency(Number(inv.paidAmount))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Balance Due</p><p className="mt-1 font-bold text-red-600">{formatCurrency(balance)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1"><Clock className="h-3 w-3" />Aging</p><p className={cn('mt-1 font-bold', agingColor)}>{agingLabel}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            {WORKFLOW_STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  {i < workflowStepIndex ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
                  <span className={cn('text-[10px] font-medium text-center', i < workflowStepIndex ? 'text-emerald-700' : 'text-muted-foreground/60')}>{s}</span>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && <div className={cn('mx-2 h-0.5 flex-1', i < workflowStepIndex - 1 ? 'bg-emerald-400' : 'bg-muted')} />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card><CardContent className="flex items-center gap-4 pt-4">
          <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">Status:</p>
          <Select value={inv.status} onValueChange={v => statusMutation.mutate(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent></Card>
        <Card><CardContent className="pt-4">{balance > 0 ? <Button size="sm" className="w-full" onClick={() => { setPayForm(p => ({ ...p, amount: String(balance.toFixed(2)) })); setShowPayment(true) }}><Plus className="mr-2 h-4 w-4" />Record Payment</Button> : <p className="text-sm text-green-600 font-medium text-center">Fully Paid</p>}</CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-2 text-sm">
          <Star className="h-4 w-4 text-amber-500" />
          <span className="font-semibold">{inv.vendorRating ? `${inv.vendorRating.toFixed(1)} / 5` : 'No rating'}</span>
          <span className="text-muted-foreground">· Outstanding {formatCurrency(inv.vendorOutstandingBalance)}</span>
        </CardContent></Card>
      </div>

      {showPayment && (
        <Card><CardHeader><CardTitle className="text-base">Record Payment</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Amount *</Label><Input type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} /></div>
          <div className="space-y-1"><Label>Date *</Label><Input type="date" value={payForm.paymentDate} onChange={e => setPayForm(p => ({ ...p, paymentDate: e.target.value }))} /></div>
          <div className="space-y-1"><Label>Method</Label>
            <Select value={payForm.paymentMethod} onValueChange={v => setPayForm(p => ({ ...p, paymentMethod: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Reference</Label><Input value={payForm.reference} onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))} /></div>
          <div className="col-span-2 flex gap-2"><Button size="sm" onClick={() => payMutation.mutate()} disabled={payMutation.isPending || !payForm.amount || !payForm.paymentDate}>{payMutation.isPending ? 'Saving…' : 'Record'}</Button><Button size="sm" variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button></div>
        </CardContent></Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="matching">Matching</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="accounting">Accounting Entries</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card><CardContent className="pt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Subtotal', formatCurrency(Number(inv.subTotal))],
              ['Tax', formatCurrency(Number(inv.taxAmount))],
              ['Shipping', formatCurrency(Number(inv.shippingCharges))],
              ['Discount', formatCurrency(-Number(inv.discountAmount))],
              ['Department', inv.department?.name ?? '—'],
              ['Cost Center', inv.costCentre?.name ?? '—'],
              ['PO Reference', inv.po?.poNumber ?? '—'],
              ['Notes', inv.notes ?? '—'],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">{l}</p>
                <p className="text-sm font-medium mt-0.5 truncate">{v}</p>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="items">
          <Card><CardContent className="pt-4">
            {inv.items.length === 0 ? <p className="text-sm text-muted-foreground">No line items recorded.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="pb-2 text-left">Description</th><th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Unit Price</th><th className="pb-2 text-right">Tax</th>
                  <th className="pb-2 text-right">Discount</th><th className="pb-2 text-left">GL Account</th>
                  <th className="pb-2 text-left">Warehouse</th><th className="pb-2 text-right">Total</th>
                </tr></thead>
                <tbody className="divide-y">
                  {inv.items.map(it => (
                    <tr key={it.id}>
                      <td className="py-2">{it.description}{it.item && <span className="text-muted-foreground text-xs ml-1">({it.item.sku})</span>}</td>
                      <td className="py-2 text-right">{Number(it.quantity)}</td>
                      <td className="py-2 text-right">{formatCurrency(Number(it.unitPrice))}</td>
                      <td className="py-2 text-right">{Number(it.taxRate)}%</td>
                      <td className="py-2 text-right">{formatCurrency(Number(it.discount))}</td>
                      <td className="py-2">{it.glAccount ? `${it.glAccount.code} ${it.glAccount.name}` : '—'}</td>
                      <td className="py-2">{it.warehouse?.name ?? '—'}</td>
                      <td className="py-2 text-right font-semibold">{formatCurrency(Number(it.totalPrice))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="matching">
          <Card><CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
              <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', MATCHING_CFG[inv.matchingStatus]?.cls)}>{MATCHING_CFG[inv.matchingStatus]?.label ?? inv.matchingStatus}</span>
            </div>
            {inv.po ? (() => {
              const poTotal = Number(inv.po.grandTotal)
              const grnTotal = inv.po.grns.reduce((sum, grn) => sum + grn.lineItems.reduce((s, li) => s + Number(li.acceptedQty) * Number(li.unitPrice), 0), 0)
              const invTotal = Number(inv.totalAmount)
              const poMatch = Math.abs(poTotal - invTotal) < 0.01
              const grnMatch = Math.abs(grnTotal - invTotal) < 0.01
              const allMatch = poMatch && grnMatch
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Purchase Order', value: poTotal },
                      { label: 'Goods Receipt', value: grnTotal },
                      { label: 'Supplier Invoice', value: invTotal },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg border p-3 text-center">
                        <p className="text-xs text-muted-foreground uppercase font-medium">{label}</p>
                        <p className="mt-1 text-lg font-bold">{formatCurrency(value)}</p>
                      </div>
                    ))}
                  </div>
                  <div className={cn('rounded-md border px-4 py-2 text-sm font-medium flex items-center gap-2', allMatch ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800')}>
                    {allMatch ? '✓ All three documents match — safe to approve payment.' : `⚠ Mismatch detected: PO ${poMatch ? '✓' : '✗'}  GRN ${grnMatch ? '✓' : '✗'}  Invoice ✓ — review before paying.`}
                  </div>
                </div>
              )
            })() : <p className="text-sm text-muted-foreground">No purchase order referenced — nothing to match against.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card><CardContent className="pt-4 space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Paid {formatCurrency(Number(inv.paidAmount))} of {formatCurrency(Number(inv.totalAmount))}</span><span>{Math.round(Number(inv.paidAmount) / Number(inv.totalAmount) * 100)}%</span></div>
              <Progress value={Math.min(100, Number(inv.totalAmount) > 0 ? Number(inv.paidAmount) / Number(inv.totalAmount) * 100 : 0)} />
            </div>
            {inv.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments recorded.</p> : (
              <table className="w-full text-sm"><thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="pb-2 text-left">Date</th><th className="pb-2 text-left">Method</th><th className="pb-2 text-left">Reference</th><th className="pb-2 text-right">Amount</th></tr></thead>
              <tbody className="divide-y">{inv.payments.map(p => <tr key={p.id}><td className="py-2">{formatDate(p.paymentDate)}</td><td className="py-2">{p.paymentMethod.replace(/_/g,' ')}</td><td className="py-2">{p.reference ?? '—'}</td><td className="py-2 text-right font-semibold">{formatCurrency(Number(p.amount))}</td></tr>)}</tbody></table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="accounting">
          <Card><CardContent className="pt-4">
            {inv.journalEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounting entries posted yet — entries are booked once the invoice is verified and sent for payment.</p>
            ) : (
              <div className="space-y-4">
                {inv.journalEntries.map(je => (
                  <div key={je.id}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5 text-muted-foreground" />{je.entryNumber} — {je.description}</p>
                      <span className="text-xs text-muted-foreground">{formatDate(je.date)}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="pb-2 text-left">Account</th><th className="pb-2 text-right">Debit</th><th className="pb-2 text-right">Credit</th></tr></thead>
                      <tbody className="divide-y">
                        {je.lines.map(l => (
                          <tr key={l.id}>
                            <td className="py-2">{l.debitAccount ? `${l.debitAccount.code} ${l.debitAccount.name}` : l.creditAccount ? `${l.creditAccount.code} ${l.creditAccount.name}` : '—'}</td>
                            <td className="py-2 text-right">{Number(l.debitAmount) > 0 ? formatCurrency(Number(l.debitAmount)) : '—'}</td>
                            <td className="py-2 text-right">{Number(l.creditAmount) > 0 ? formatCurrency(Number(l.creditAmount)) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardContent className="pt-4">
            <div className="space-y-4">
              {activity.map((a, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <FileClock className="h-4 w-4 text-blue-500" />
                    {i < activity.length - 1 && <div className="mt-1 h-full w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">{a.label}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(a.date, 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
