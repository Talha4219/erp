'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const STATUSES = ['DRAFT', 'DISPATCHED', 'DELIVERED', 'CANCELLED']
const STATUS_VARIANT: Record<string, 'secondary'|'info'|'success'|'destructive'> = { DRAFT: 'secondary', DISPATCHED: 'info', DELIVERED: 'success', CANCELLED: 'destructive' }

type DNDetail = { id: string; dnNumber: string; status: string; deliveryDate: string; carrier: string | null; trackingNumber: string | null; notes: string | null; customer: { name: string; address: string | null; city: string | null; phone: string | null }; so: { soNumber: string; lineItems: Array<{ id: string; description: string; quantity: number; deliveredQty: number }> }; lineItems: Array<{ id: string; description: string; orderedQty: number; deliveredQty: number }> }

export function PageClient({ id, initialData }: { id: string; initialData: DNDetail }) {
  const qc = useQueryClient()

  const { data: dn, isLoading } = useQuery({ queryKey: ['dn', id], queryFn: () => api.get<DNDetail>(`/api/sales/delivery-notes/${id}`).then((r) => r.data!), initialData, staleTime: 30_000 })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/api/sales/delivery-notes/${id}`, { status }),
    onSuccess: (res) => { toast.success('Status updated'); if (res.success && res.data) qc.setQueryData(['dn', id], res.data); qc.invalidateQueries({ queryKey: ['dn', id] }) },
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (!dn) return <div className="p-6 text-muted-foreground">Not found.</div>

  return (
    <div className="space-y-6">
      <PageHeader title={dn.dnNumber} description={`Delivery for ${dn.so.soNumber}`} actions={<Button variant="outline" asChild><Link href="/sales/delivery-notes"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Status</p><div className="mt-2"><Badge variant={STATUS_VARIANT[dn.status] ?? 'secondary'}>{dn.status}</Badge></div></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Delivery Date</p><p className="mt-1 font-semibold text-sm">{formatDate(dn.deliveryDate)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Carrier</p><p className="mt-1 font-semibold text-sm">{dn.carrier ?? '—'}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-medium">Tracking</p><p className="mt-1 font-semibold text-sm">{dn.trackingNumber ?? '—'}</p></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><CardContent className="pt-4 space-y-1 text-sm">
          <p className="font-semibold">{dn.customer.name}</p>
          {dn.customer.address && <p className="text-muted-foreground">{dn.customer.address}</p>}
          {dn.customer.city && <p className="text-muted-foreground">{dn.customer.city}</p>}
          {dn.customer.phone && <p className="text-muted-foreground">{dn.customer.phone}</p>}
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 pt-4">
          <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">Update Status:</p>
          <Select value={dn.status} onValueChange={(v) => statusMutation.mutate(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Delivered Items</CardTitle></CardHeader>
        <CardContent>
          {dn.lineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items recorded. Items were taken from the Sales Order.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="pb-2 text-left">Description</th><th className="pb-2 text-right">Ordered</th><th className="pb-2 text-right">Delivered</th></tr></thead>
              <tbody className="divide-y">
                {dn.lineItems.map((l) => (
                  <tr key={l.id}><td className="py-2">{l.description}</td><td className="py-2 text-right">{Number(l.orderedQty)}</td><td className="py-2 text-right">{Number(l.deliveredQty)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {dn.notes && <p className="mt-4 text-sm text-muted-foreground border-t pt-3">{dn.notes}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
