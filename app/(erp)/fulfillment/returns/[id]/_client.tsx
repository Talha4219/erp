'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { FulfillmentStatusBadge } from '@/components/modules/fulfillment/FulfillmentStatusBadge'
import { toast } from 'sonner'
import { RotateCcw, ArrowLeft, Loader2, CheckCircle2, XCircle, FileText } from 'lucide-react'
import Link from 'next/link'
import { DetailPageSkeleton } from '@/components/modules/fulfillment/FulfillmentSkeletons'

type ReturnDetail = {
  id: string; returnNumber: string; fulfillmentNumber: string; salesOrderNumber: string
  customer: { id: string; name: string; email: string; phone: string }
  status: string; reason: string; notes: string; createdAt: string
  lineItems: Array<{ id: string; product: { name: string; sku: string }; quantity: number; returnQuantity: number }>
  inspection?: { result: string; notes: string; inspectedBy: string; date: string }
}

export function PageClient({ id, initialData }: { id: string; initialData: ReturnDetail }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [inspectionNotes, setInspectionNotes] = useState('')
  const [inspectionResult, setInspectionResult] = useState('APPROVED')

  const { data: ret, isLoading, error } = useQuery({
    queryKey: ['fulfillment-return', id],
    queryFn: () => api.get<ReturnDetail>(`/api/fulfillment/returns/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  const updateMutation = useMutation({
    mutationFn: (body: unknown) => api.patch(`/api/fulfillment/returns/${id}`, body),
    onSuccess: (res) => { if (res.success && res.data) queryClient.setQueryData(['fulfillment-return', id], res.data); queryClient.invalidateQueries({ queryKey: ['fulfillment-return', id] }); toast.success('Return updated') },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <DetailPageSkeleton />
  if (error || !ret) return <EmptyState icon={RotateCcw} title="Return not found" />

  const handleInspect = () => {
    updateMutation.mutate({ status: inspectionResult === 'APPROVED' ? 'APPROVED' : 'REJECTED', inspection: { result: inspectionResult, notes: inspectionNotes } })
  }

  return (
    <div className="space-y-6">
      <PageHeader title={ret.returnNumber} description={`Order: ${ret.fulfillmentNumber}`} icon={RotateCcw} iconColor="text-rose-600"
        badge={<FulfillmentStatusBadge status={ret.status} />}
        actions={<Button variant="outline" size="sm" onClick={() => router.push('/fulfillment/returns')}><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Button>} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Return Information</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Customer</p><p className="font-medium mt-1">{ret.customer.name}</p><p className="text-xs text-muted-foreground">{ret.customer.email}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sales Order</p><p className="font-medium mt-1">{ret.salesOrderNumber}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Reason</p><p className="font-medium mt-1">{ret.reason}</p></div>
                <div><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Created</p><p className="font-medium mt-1">{formatDate(ret.createdAt)}</p></div>
              </div>
              {ret.notes && (<div className="mt-4"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p><p className="text-sm mt-1 text-muted-foreground">{ret.notes}</p></div>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />Items</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider"><th className="pb-2 font-medium">Product</th><th className="pb-2 font-medium">SKU</th><th className="pb-2 font-medium text-right">Original Qty</th><th className="pb-2 font-medium text-right">Return Qty</th></tr></thead>
                <tbody>{ret.lineItems.map((item) => (<tr key={item.id} className="border-b last:border-0"><td className="py-2 font-medium">{item.product.name}</td><td className="py-2 text-muted-foreground">{item.product.sku}</td><td className="py-2 text-right">{item.quantity}</td><td className="py-2 text-right">{item.returnQuantity}</td></tr>))}</tbody>
              </table>
            </CardContent>
          </Card>

          {ret.inspection && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Inspection Result</CardTitle></CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Result:</span> {ret.inspection.result}</p>
                  <p><span className="text-muted-foreground">Inspected by:</span> {ret.inspection.inspectedBy}</p>
                  <p><span className="text-muted-foreground">Date:</span> {formatDate(ret.inspection.date)}</p>
                  {ret.inspection.notes && <p><span className="text-muted-foreground">Notes:</span> {ret.inspection.notes}</p>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {ret.status === 'PENDING' && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Inspection</CardTitle></CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="space-y-2">
                  <Label>Decision</Label>
                  <select value={inspectionResult} onChange={(e) => setInspectionResult(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="APPROVED">Approve</option><option value="REJECTED">Reject</option>
                  </select>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={inspectionNotes} onChange={(e) => setInspectionNotes(e.target.value)} placeholder="Inspection notes" rows={3} /></div>
                <Button className="w-full" onClick={handleInspect} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {inspectionResult === 'APPROVED' ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
                  {inspectionResult === 'APPROVED' ? 'Approve Return' : 'Reject Return'}
                </Button>
              </CardContent>
            </Card>
          )}
          <Button variant="outline" className="w-full" asChild><Link href={`/fulfillment/orders/${ret.fulfillmentNumber ? ret.id : '#'}`}>View Fulfillment Order</Link></Button>
        </div>
      </div>
    </div>
  )
}
