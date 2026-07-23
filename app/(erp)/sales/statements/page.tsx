'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatCard } from '@/components/shared/StatCard'
import { DollarSign, FileText, AlertCircle, TrendingDown } from 'lucide-react'

type Customer = { id: string; name: string; email: string | null }
type Statement = { customer: { name: string; email: string | null; phone: string | null; address: string | null; city: string | null }; invoices: Array<{ id: string; invoiceNumber: string; invoiceDate: string; dueDate: string; totalAmount: number; paidAmount: number; status: string }>; payments: Array<{ id: string; amount: number; paymentDate: string; method: string; reference: string | null; invoice: { invoiceNumber: string } }>; summary: { totalBilled: number; totalPaid: number; totalOutstanding: number; overdueCount: number } }

const STATUS_VARIANT: Record<string, 'secondary'|'info'|'warning'|'success'|'destructive'> = { DRAFT: 'secondary', SENT: 'info', PARTIALLY_PAID: 'warning', PAID: 'success', OVERDUE: 'destructive', CANCELLED: 'secondary' }

export default function StatementsPage() {
  const [selectedId, setSelectedId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [fetch, setFetch] = useState(false)

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => api.get<Customer[]>('/api/sales/customers').then((r) => r.data ?? []), placeholderData: (previousData) => previousData })

  const url = selectedId ? `/api/sales/statements/${selectedId}?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}` : null

  const { data: stmt, isLoading } = useQuery({
    queryKey: ['statement', selectedId, from, to],
    queryFn: () => api.get<Statement>(url!).then((r) => r.data!),
    enabled: fetch && !!selectedId,
  })

  const generate = () => { if (selectedId) setFetch(true) }

  return (
    <div className="space-y-6">
      <PageHeader title="Customer Statements" description="Generate account statements for customers" />
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1 w-64"><Label>Customer *</Label>
              <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setFetch(false) }}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" /></div>
            <Button onClick={generate} disabled={!selectedId}>Generate Statement</Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <p className="text-muted-foreground">Loading statement…</p>}
      {stmt && (
        <div className="space-y-6" id="statement-print">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{stmt.customer.name}</h2>
              {stmt.customer.email && <p className="text-sm text-muted-foreground">{stmt.customer.email}</p>}
              {stmt.customer.address && <p className="text-sm text-muted-foreground">{stmt.customer.address}{stmt.customer.city ? `, ${stmt.customer.city}` : ''}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard title="Total Billed" value={formatCurrency(stmt.summary.totalBilled)} icon={FileText} iconColor="text-blue-600" />
            <StatCard title="Total Paid" value={formatCurrency(stmt.summary.totalPaid)} icon={DollarSign} iconColor="text-green-600" />
            <StatCard title="Outstanding" value={formatCurrency(stmt.summary.totalOutstanding)} icon={TrendingDown} iconColor="text-orange-600" />
            <StatCard title="Overdue Invoices" value={stmt.summary.overdueCount} icon={AlertCircle} iconColor="text-red-600" />
          </div>
          <Card>
            <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="pb-2 text-left">Invoice</th><th className="pb-2 text-right">Date</th><th className="pb-2 text-right">Due</th><th className="pb-2 text-right">Amount</th><th className="pb-2 text-right">Paid</th><th className="pb-2 text-right">Balance</th><th className="pb-2 text-center">Status</th>
                </tr></thead>
                <tbody className="divide-y">
                  {stmt.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2 font-medium">{inv.invoiceNumber}</td>
                      <td className="py-2 text-right">{formatDate(inv.invoiceDate)}</td>
                      <td className="py-2 text-right">{formatDate(inv.dueDate)}</td>
                      <td className="py-2 text-right">{formatCurrency(Number(inv.totalAmount))}</td>
                      <td className="py-2 text-right">{formatCurrency(Number(inv.paidAmount))}</td>
                      <td className="py-2 text-right font-semibold">{formatCurrency(Number(inv.totalAmount) - Number(inv.paidAmount))}</td>
                      <td className="py-2 text-center"><Badge variant={STATUS_VARIANT[inv.status] ?? 'secondary'} className="text-xs">{inv.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t font-bold">
                  <td colSpan={3} className="pt-2">Total</td>
                  <td className="pt-2 text-right">{formatCurrency(stmt.summary.totalBilled)}</td>
                  <td className="pt-2 text-right">{formatCurrency(stmt.summary.totalPaid)}</td>
                  <td className="pt-2 text-right">{formatCurrency(stmt.summary.totalOutstanding)}</td>
                  <td />
                </tr></tfoot>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
            <CardContent>
              {stmt.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments recorded.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="pb-2 text-left">Date</th><th className="pb-2 text-left">Invoice</th><th className="pb-2 text-left">Method</th><th className="pb-2 text-left">Reference</th><th className="pb-2 text-right">Amount</th></tr></thead>
                  <tbody className="divide-y">
                    {stmt.payments.map((p) => (
                      <tr key={p.id}><td className="py-2">{formatDate(p.paymentDate)}</td><td className="py-2">{p.invoice.invoiceNumber}</td><td className="py-2">{p.method.replace(/_/g,' ')}</td><td className="py-2">{p.reference ?? '—'}</td><td className="py-2 text-right">{formatCurrency(Number(p.amount))}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
