'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, FileText } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED']
const STATUS_VARIANT: Record<string, 'warning'|'success'|'destructive'|'info'|'secondary'> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', COMPLETED: 'info' }

type ReturnDetail = { id: string; returnNumber: string; status: string; returnDate: string; reason: string; notes: string | null; totalAmount: number; customer: { name: string; email: string | null }; invoice: { invoiceNumber: string }; lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: number; totalPrice: number }>; creditNote: { id: string; creditNoteNumber: string; status: string; amount: number } | null }

export function PageClient({ id, initialData }: { id: string; initialData: ReturnDetail }) {
  const qc = useQueryClient()

  const { data: ret, isLoading } = useQuery({ queryKey: ['sales-return', id], queryFn: () => api.get<ReturnDetail>(`/api/sales/returns/${id}`).then((r) => r.data!), initialData, staleTime: 30_000 })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/api/sales/returns/${id}`, { status }),
    onSuccess: (res) => { toast.success('Status updated'); if (res.success && res.data) qc.setQueryData(['sales-return', id], res.data); qc.invalidateQueries({ queryKey: ['sales-return', id] }) },
  })
  const issueCNMutation = useMutation({
    mutationFn: () => api.patch(`/api/sales/returns/${id}`, { action: 'issue-credit-note' }),
    onSuccess: (res) => { toast.success('Credit note issued'); if (res.success && res.data) qc.setQueryData(['sales-return', id], res.data); qc.invalidateQueries({ queryKey: ['sales-return', id] }) },
    onError: () => toast.error('Failed to issue credit note'),
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (!ret) return <div className="p-6 text-muted-foreground">Not found.</div>

  return (
    <div className="space-y-6">
      <PageHeader title={ret.returnNumber} description={`Return for ${ret.invoice.invoiceNumber}`} actions={<Button variant="outline" asChild><Link href="/sales/returns"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Status</p><div className="mt-2"><Badge variant={STATUS_VARIANT[ret.status] ?? 'secondary'}>{ret.status}</Badge></div></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Return Date</p><p className="mt-1 font-semibold text-sm">{formatDate(ret.returnDate)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Total Amount</p><p className="mt-1 text-lg font-bold">{formatCurrency(Number(ret.totalAmount))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Credit Note</p><div className="mt-1">{ret.creditNote ? <Link href={`/sales/credit-notes`} className="text-sm text-primary hover:underline font-medium">{ret.creditNote.creditNoteNumber}</Link> : <span className="text-sm text-muted-foreground">Not issued</span>}</div></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><CardContent className="pt-4 space-y-1 text-sm">
          <p className="font-semibold">{ret.customer.name}</p>
          {ret.customer.email && <p className="text-muted-foreground">{ret.customer.email}</p>}
          <p className="text-muted-foreground">Reason: {ret.reason}</p>
          {ret.notes && <p className="text-muted-foreground">{ret.notes}</p>}
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">Status:</p>
            <Select value={ret.status} onValueChange={(v) => statusMutation.mutate(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!ret.creditNote && ret.status === 'APPROVED' && (
            <Button size="sm" variant="outline" onClick={() => issueCNMutation.mutate()} disabled={issueCNMutation.isPending}><FileText className="mr-2 h-4 w-4" />{issueCNMutation.isPending ? 'Issuing…' : 'Issue Credit Note'}</Button>
          )}
        </CardContent></Card>
      </div>
      {ret.lineItems.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Return Items</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="pb-2 text-left">Description</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Unit Price</th><th className="pb-2 text-right">Total</th></tr></thead>
              <tbody className="divide-y">
                {ret.lineItems.map((l) => (
                  <tr key={l.id}><td className="py-2">{l.description}</td><td className="py-2 text-right">{Number(l.quantity)}</td><td className="py-2 text-right">{formatCurrency(Number(l.unitPrice))}</td><td className="py-2 text-right">{formatCurrency(Number(l.totalPrice))}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
