'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

type Customer = { id: string; customerCode: string; name: string; isActive?: boolean }
type LineItem = { description: string; quantity: number; unitPrice: number; discount: number; taxRate: number }

const emptyLine = (): LineItem => ({ description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 })
const lineTotal = (li: LineItem) => li.quantity * li.unitPrice * (1 - li.discount / 100) * (1 + li.taxRate / 100)

export function PageClient({ customers }: { customers: Customer[] }) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const [customerId, setCustomerId] = useState('')
  const [quotationDate, setQuotationDate] = useState(today)
  const [expiryDate, setExpiryDate] = useState(thirtyDays)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([emptyLine()])
  const [saving, setSaving] = useState(false)

  function updateLine(i: number, field: keyof LineItem, raw: string) {
    setLines((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: field === 'description' ? raw : Number(raw) }
      return next
    })
  }

  const subtotal = lines.reduce((s, li) => s + lineTotal(li), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) return toast.error('Please select a customer')
    if (lines.some((li) => !li.description)) return toast.error('All line items need a description')

    setSaving(true)
    try {
      await api.post('/api/sales/quotations', {
        customerId,
        quotationDate,
        expiryDate,
        notes: notes || undefined,
        lineItems: lines,
      })
      toast.success('Quotation created')
      router.push('/sales/quotations')
    } catch {
      toast.error('Failed to create quotation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Quotation"
        description="Create a sales quotation for a customer"
        actions={
          <Button variant="outline" asChild>
            <Link href="/sales/quotations"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Quotation Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.filter((c) => c.isActive !== false).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quotation Date *</Label>
              <Input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Expiry Date *</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required />
            </div>
            <div className="col-span-full space-y-1">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes or terms" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => setLines((p) => [...p, emptyLine()])}>
              <Plus className="mr-1 h-4 w-4" />Add Line
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Description *</th>
                    <th className="pb-2 pr-2 font-medium w-20">Qty</th>
                    <th className="pb-2 pr-2 font-medium w-28">Unit Price</th>
                    <th className="pb-2 pr-2 font-medium w-20">Disc %</th>
                    <th className="pb-2 pr-2 font-medium w-20">Tax %</th>
                    <th className="pb-2 pr-2 font-medium w-28 text-right">Total</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((li, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-2">
                        <Input value={li.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder="Description" />
                      </td>
                      <td className="py-2 pr-2">
                        <Input type="number" min="0.001" step="any" value={li.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} />
                      </td>
                      <td className="py-2 pr-2">
                        <Input type="number" min="0" step="0.01" value={li.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)} />
                      </td>
                      <td className="py-2 pr-2">
                        <Input type="number" min="0" max="100" step="0.1" value={li.discount} onChange={(e) => updateLine(i, 'discount', e.target.value)} />
                      </td>
                      <td className="py-2 pr-2">
                        <Input type="number" min="0" max="100" step="0.1" value={li.taxRate} onChange={(e) => updateLine(i, 'taxRate', e.target.value)} />
                      </td>
                      <td className="py-2 pr-2 text-right font-medium">{formatCurrency(lineTotal(li))}</td>
                      <td className="py-2">
                        {lines.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="text-red-500"
                            onClick={() => setLines((p) => p.filter((_, j) => j !== i))}>
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
              <div className="w-52 space-y-1 text-sm">
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push('/sales/quotations')}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Quotation'}</Button>
        </div>
      </form>
    </div>
  )
}
