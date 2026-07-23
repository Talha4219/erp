'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

type Vendor = { id: string; vendorCode: string; name: string }
type PRDetail = { id: string; prNumber: string; vendorId: string | null; vendor: { id: string; name: string } | null; lineItems: Array<{ description: string; quantity: number; uom: string; estimatedUnitPrice: number }> }

type LineItem = { description: string; quantity: number; uom: string; unitPrice: number; taxRate: number }
const emptyLine = (): LineItem => ({ description: '', quantity: 1, uom: 'each', unitPrice: 0, taxRate: 0 })

function PageContentForm({ vendors }: { vendors: Vendor[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prId = searchParams.get('prId')

  const [vendorId, setVendorId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [shippingCost, setShippingCost] = useState(0)
  const [terms, setTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([emptyLine()])
  const [saving, setSaving] = useState(false)

  // Load PR data if prId is provided
  const { data: pr } = useQuery({
    queryKey: ['pr-for-po', prId],
    queryFn: () => api.get<PRDetail>(`/api/procurement/purchase-requests/${prId}`).then(r => r.data!),
    enabled: !!prId,
  })

  // Pre-fill from PR when loaded
  useEffect(() => {
    if (!pr) return
    if (pr.vendorId) setVendorId(pr.vendorId)
    if (pr.lineItems.length > 0) {
      setLines(pr.lineItems.map(li => ({
        description: li.description,
        quantity: Number(li.quantity),
        uom: li.uom,
        unitPrice: Number(li.estimatedUnitPrice),
        taxRate: 0,
      })))
    }
  }, [pr])

  function updateLine(i: number, field: keyof LineItem, raw: string) {
    setLines(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: ['quantity', 'unitPrice', 'taxRate'].includes(field) ? Number(raw) : raw }
      return next
    })
  }

  const lineTotal = (li: LineItem) => li.quantity * li.unitPrice * (1 + li.taxRate / 100)
  const subtotal = lines.reduce((s, li) => s + lineTotal(li), 0)
  const grandTotal = subtotal + shippingCost

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vendorId) return toast.error('Please select a vendor')
    if (lines.some(li => !li.description)) return toast.error('All line items need a description')
    setSaving(true)
    try {
      const res = await api.post<{ id: string }>('/api/procurement/purchase-orders', {
        vendorId, orderDate,
        deliveryDate: deliveryDate || undefined,
        shippingCost, terms: terms || undefined, notes: notes || undefined,
        prId: prId || undefined,
        status: 'DRAFT',
        lineItems: lines,
      })
      toast.success('Purchase order created')
      router.push(`/procurement/purchase-orders/${res.data!.id}`)
    } catch {
      toast.error('Failed to create purchase order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Purchase Order"
        description={pr ? `From Purchase Request: ${pr.prNumber}` : 'Create a new purchase order'}
        actions={
          <Button variant="outline" asChild>
            <Link href={pr ? `/procurement/purchase-requests/${prId}` : '/procurement/purchase-orders'}>
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Link>
          </Button>
        }
      />

      {pr && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200 flex items-center gap-2">
          <Badge variant="info" className="text-xs">{pr.prNumber}</Badge>
          Line items and vendor pre-filled from the approved purchase request. Review and adjust as needed.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>Vendor *</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Order Date *</Label>
              <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Delivery Date</Label>
              <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Shipping Cost</Label>
              <Input type="number" min="0" step="0.01" value={shippingCost} onChange={e => setShippingCost(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Payment Terms</Label>
              <Input value={terms} onChange={e => setTerms(e.target.value)} placeholder="e.g. Net 30" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => setLines(p => [...p, emptyLine()])}>
              <Plus className="mr-1 h-4 w-4" />Add Item
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Description *</th>
                    <th className="pb-2 pr-2 font-medium w-20">Qty</th>
                    <th className="pb-2 pr-2 font-medium w-20">UOM</th>
                    <th className="pb-2 pr-2 font-medium w-28">Unit Price</th>
                    <th className="pb-2 pr-2 font-medium w-20">Tax %</th>
                    <th className="pb-2 pr-2 font-medium w-28 text-right">Total</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((li, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-2"><Input value={li.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Item description" /></td>
                      <td className="py-2 pr-2"><Input type="number" min="0.001" step="any" value={li.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} /></td>
                      <td className="py-2 pr-2"><Input value={li.uom} onChange={e => updateLine(i, 'uom', e.target.value)} placeholder="each" /></td>
                      <td className="py-2 pr-2"><Input type="number" min="0" step="0.01" value={li.unitPrice} onChange={e => updateLine(i, 'unitPrice', e.target.value)} /></td>
                      <td className="py-2 pr-2"><Input type="number" min="0" max="100" step="0.1" value={li.taxRate} onChange={e => updateLine(i, 'taxRate', e.target.value)} /></td>
                      <td className="py-2 pr-2 text-right font-medium">{formatCurrency(lineTotal(li))}</td>
                      <td className="py-2">
                        {lines.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => setLines(p => p.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{formatCurrency(shippingCost)}</span></div>
                <div className="flex justify-between border-t pt-1 font-semibold"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create Purchase Order'}</Button>
        </div>
      </form>
    </div>
  )
}

export function PageClient({ vendors }: { vendors: Vendor[] }) {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <PageContentForm vendors={vendors} />
    </Suspense>
  )
}
