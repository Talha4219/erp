'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type Item = { description: string; unitPrice: string; minQty: string; discount: string }
type PriceListDetail = { id: string; code: string; name: string; currency: string; items: Array<{ id: string; description: string; unitPrice: number; minQty: number; discount: number; item: { sku: string; name: string } | null }> }

const emptyItem = (): Item => ({ description: '', unitPrice: '0', minQty: '1', discount: '0' })

export function PageClient({ id, initialData }: { id: string; initialData: PriceListDetail }) {
  const qc = useQueryClient()
  const [rows, setRows] = useState<Item[]>([])
  const [synced, setSynced] = useState(false)

  const { data: list, isLoading } = useQuery({
    queryKey: ['price-list', id],
    queryFn: () => api.get<PriceListDetail>(`/api/sales/price-lists/${id}`).then((r) => r.data!),
    initialData,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (list && !synced) {
      setRows(list.items.map((i) => ({ description: i.description, unitPrice: String(i.unitPrice), minQty: String(i.minQty), discount: String(i.discount) })))
      setSynced(true)
    }
  }, [list, synced])

  const addRow = () => setRows((p) => [...p, emptyItem()])
  const removeRow = (i: number) => setRows((p) => p.filter((_, j) => j !== i))
  const updateRow = (i: number, field: keyof Item, value: string) => setRows((p) => p.map((r, j) => j === i ? { ...r, [field]: value } : r))

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/api/sales/price-lists/${id}`, { items: rows.map((r) => ({ description: r.description, unitPrice: Number(r.unitPrice), minQty: Number(r.minQty), discount: Number(r.discount) })) }),
    onSuccess: (res) => { toast.success('Price list saved'); if (res.success && res.data) qc.setQueryData(['price-list', id], res.data); qc.invalidateQueries({ queryKey: ['price-list', id] }) },
    onError: () => toast.error('Failed to save'),
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (!list) return <div className="p-6 text-muted-foreground">Not found.</div>

  return (
    <div className="space-y-6">
      <PageHeader title={list.name} description={`${list.code} · ${list.currency}`} actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/sales/price-lists"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}><Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? 'Saving…' : 'Save'}</Button>
        </div>
      } />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Price Items</CardTitle><Button size="sm" onClick={addRow}><Plus className="mr-2 h-4 w-4" />Add Item</Button></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs uppercase">
                <th className="pb-2 text-left pr-2">Description</th>
                <th className="pb-2 text-right pr-2 w-28">Unit Price</th>
                <th className="pb-2 text-right pr-2 w-24">Min Qty</th>
                <th className="pb-2 text-right pr-2 w-20">Discount %</th>
                <th className="pb-2 w-8" />
              </tr></thead>
              <tbody className="divide-y">
                {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground text-xs">No items. Click &quot;Add Item&quot; to start.</td></tr>}
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2"><Input value={row.description} onChange={(e) => updateRow(i, 'description', e.target.value)} className="h-8 text-sm" /></td>
                    <td className="py-1 pr-2"><Input type="number" step="0.01" value={row.unitPrice} onChange={(e) => updateRow(i, 'unitPrice', e.target.value)} className="h-8 text-sm text-right" /></td>
                    <td className="py-1 pr-2"><Input type="number" step="1" value={row.minQty} onChange={(e) => updateRow(i, 'minQty', e.target.value)} className="h-8 text-sm text-right" /></td>
                    <td className="py-1 pr-2"><Input type="number" step="0.1" value={row.discount} onChange={(e) => updateRow(i, 'discount', e.target.value)} className="h-8 text-sm text-right" /></td>
                    <td className="py-1"><Button variant="ghost" size="icon" className="text-red-500 h-8 w-8" onClick={() => removeRow(i)}><Trash2 className="h-3 w-3" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
