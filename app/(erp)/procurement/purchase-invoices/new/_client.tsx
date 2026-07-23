'use client'
import { useState, useMemo, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatCurrency, cn, itemDisplayName } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft, ChevronRight, Building2, FileText, ListChecks, Receipt,
  ShieldCheck, Plus, Trash2, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type Vendor = { id: string; name: string; paymentTerms: number; creditLimit: number | null; email: string | null }
type PO = { id: string; poNumber: string; vendorId: string; grandTotal: number; status: string }
type PODetail = {
  id: string; poNumber: string; grandTotal: number
  lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: number; itemId: string | null }>
}
type Item = { id: string; name: string; packing: string | null; sku: string }
type Account = { id: string; code: string; name: string }
type Warehouse = { id: string; name: string }
type Department = { id: string; name: string }
type CostCentre = { id: string; name: string; code: string }

type Line = {
  itemId: string; description: string; quantity: string; unitPrice: string
  taxRate: string; discount: string; glAccountId: string; warehouseId: string
}

const STEPS = ['Supplier Info', 'Reference Documents', 'Items', 'Tax & Charges', 'Verify & Submit']
const CURRENCIES = ['GBP', 'USD', 'EUR']

const emptyLine = (): Line => ({ itemId: '', description: '', quantity: '1', unitPrice: '0', taxRate: '0', discount: '0', glAccountId: '', warehouseId: '' })

function lineTotals(l: Line) {
  const qty = Number(l.quantity) || 0, price = Number(l.unitPrice) || 0
  const sub = qty * price
  const tax = sub * (Number(l.taxRate) || 0) / 100
  const total = sub + tax - (Number(l.discount) || 0)
  return { sub, tax, total }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function PageContentForm(props: {
  vendors: Vendor[]
  pos: PO[]
  items: Item[]
  accounts: Account[]
  warehouses: Warehouse[]
  departments: Department[]
  costCentres: CostCentre[]
}) {
  const { vendors, pos, items, accounts, warehouses, departments, costCentres } = props
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState(0)
  const [vendorId, setVendorId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [currencyCode, setCurrencyCode] = useState('GBP')
  const [exchangeRate, setExchangeRate] = useState('1')
  const [poId, setPoId] = useState(searchParams.get('poId') ?? '')
  const [departmentId, setDepartmentId] = useState('')
  const [costCentreId, setCostCentreId] = useState('')
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [shippingCharges, setShippingCharges] = useState('0')
  const [notes, setNotes] = useState('')
  const [financeNotes, setFinanceNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: poDetail } = useQuery({
    queryKey: ['po-detail-for-invoice', poId],
    queryFn: () => api.get<PODetail>(`/api/procurement/purchase-orders/${poId}`).then(r => r.data!),
    enabled: !!poId,
  })

  const vendor = vendors.find(v => v.id === vendorId)
  const vendorPOs = useMemo(() => pos.filter(p => p.vendorId === vendorId && p.status !== 'CANCELLED'), [pos, vendorId])

  // Default due date from vendor payment terms
  useEffect(() => {
    if (vendor && !dueDate) {
      const d = new Date(invoiceDate)
      d.setDate(d.getDate() + (vendor.paymentTerms || 30))
      setDueDate(d.toISOString().split('T')[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor])

  function loadItemsFromPO() {
    if (!poDetail) return
    setLines(poDetail.lineItems.map(li => ({
      itemId: li.itemId ?? '', description: li.description, quantity: String(li.quantity),
      unitPrice: String(li.unitPrice), taxRate: '0', discount: '0', glAccountId: '', warehouseId: '',
    })))
    toast.success('Items loaded from purchase order')
  }

  const updateLine = (i: number, k: keyof Line, v: string) => setLines(p => p.map((l, j) => j === i ? { ...l, [k]: v } : l))
  const addLine = () => setLines(p => [...p, emptyLine()])
  const removeLine = (i: number) => setLines(p => p.filter((_, j) => j !== i))

  const { subTotal, taxAmount, discountAmount, shipping, grandTotal } = useMemo(() => {
    const subTotal = lines.reduce((s, l) => s + lineTotals(l).sub, 0)
    const taxAmount = lines.reduce((s, l) => s + lineTotals(l).tax, 0)
    const discountAmount = lines.reduce((s, l) => s + (Number(l.discount) || 0), 0)
    const shipping = Number(shippingCharges) || 0
    const grandTotal = subTotal + taxAmount + shipping - discountAmount
    return { subTotal, taxAmount, discountAmount, shipping, grandTotal }
  }, [lines, shippingCharges])

  const poTotal = poDetail ? Number(poDetail.grandTotal) : null
  const poMatch = poTotal !== null ? Math.abs(poTotal - grandTotal) < 0.01 : null

  async function handleSubmit() {
    if (!vendorId || !invoiceDate || !dueDate) return toast.error('Supplier, invoice date and due date are required')
    if (lines.length === 0 || lines.some(l => !l.description || Number(l.unitPrice) <= 0)) return toast.error('Add at least one valid line item')
    setSaving(true)
    try {
      const res = await api.post<{ id: string }>('/api/procurement/vendor-invoices', {
        vendorId, poId: poId || undefined, invoiceDate, dueDate,
        currencyCode, exchangeRate: Number(exchangeRate) || 1,
        departmentId: departmentId || undefined, costCentreId: costCentreId || undefined,
        shippingCharges: shipping, notes: notes || undefined, financeNotes: financeNotes || undefined,
        items: lines.map(l => ({
          itemId: l.itemId || undefined, description: l.description, quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate), discount: Number(l.discount),
          glAccountId: l.glAccountId || undefined, warehouseId: l.warehouseId || undefined,
        })),
      })
      toast.success('Invoice created')
      router.push(`/procurement/purchase-invoices/${res.data!.id}`)
    } catch {
      toast.error('Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Sticky wizard header */}
      <div className="sticky top-0 z-10 -mx-4 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link href="/procurement/purchase-invoices"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-base font-bold leading-tight">New Purchase Invoice</h1>
              <p className="text-xs text-muted-foreground">{vendor ? vendor.name : 'Select a supplier to begin'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Grand Total</p>
            <p className="text-sm font-bold text-blue-600">{formatCurrency(grandTotal, currencyCode)}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-0.5 flex-1 min-w-0">
              <button type="button" onClick={() => i < step && setStep(i)}
                className={cn(
                  'flex-1 rounded-full px-2 py-1 text-[10px] font-semibold text-center truncate',
                  i < step ? 'bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200'
                    : i === step ? 'bg-blue-600 text-white'
                    : 'bg-muted text-muted-foreground/40',
                )}>
                {i < step && <span className="mr-0.5">✓</span>}{s}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/20" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 0: Supplier Info */}
      {step === 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card >
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-500" />Supplier Information</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Supplier *</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs font-semibold">Invoice Date *</Label><Input type="date" className="h-8 text-xs" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs font-semibold">Due Date *</Label><Input type="date" className="h-8 text-xs" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Currency *</Label>
                <Select value={currencyCode} onValueChange={setCurrencyCode}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {currencyCode !== 'GBP' && (
                <div className="space-y-1.5"><Label className="text-xs font-semibold">Exchange Rate</Label><Input type="number" step="0.0001" className="h-8 text-xs" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} /></div>
              )}
            </CardContent>
          </Card>

          {vendor && (
            <Card className="border-blue-200 bg-blue-50/40 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold text-blue-700">Supplier Summary</CardTitle></CardHeader>
              <CardContent className="px-5 pb-4 grid grid-cols-2 gap-3">
                {[
                  { l: 'Payment Terms', v: `${vendor.paymentTerms} days` },
                  { l: 'Credit Limit', v: vendor.creditLimit ? formatCurrency(Number(vendor.creditLimit)) : '—' },
                  { l: 'Email', v: vendor.email ?? '—' },
                  { l: 'Open POs', v: String(vendorPOs.length) },
                ].map(({ l, v }) => (
                  <div key={l} className="rounded-lg border border-blue-200/60 bg-white/60 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">{l}</p>
                    <p className="text-xs font-medium mt-0.5 truncate text-blue-900">{v}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 1: Reference Documents */}
      {step === 1 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card >
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-purple-500" />Reference Documents</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Purchase Order</Label>
                <Select value={poId} onValueChange={setPoId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None — direct invoice" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None — direct invoice</SelectItem>
                    {vendorPOs.map(p => <SelectItem key={p.id} value={p.id}>{p.poNumber} — {formatCurrency(Number(p.grandTotal))}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Department</Label>
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Cost Center</Label>
                  <Select value={costCentreId} onValueChange={setCostCentreId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {costCentres.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {poDetail && (
            <Card >
              <CardHeader className="pb-2 pt-4 px-5 flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">PO Summary — {poDetail.poNumber}</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={loadItemsFromPO}>Load Items from PO</Button>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 text-center"><p className="text-xs text-muted-foreground uppercase font-medium">PO Value</p><p className="mt-1 text-lg font-bold">{formatCurrency(Number(poDetail.grandTotal))}</p></div>
                  <div className="rounded-lg border p-3 text-center"><p className="text-xs text-muted-foreground uppercase font-medium">Line Items</p><p className="mt-1 text-lg font-bold">{poDetail.lineItems.length}</p></div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 2: Items */}
      {step === 2 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 pt-4 px-5 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4 text-emerald-500" />Invoice Items</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addLine}><Plus className="mr-1 h-3 w-3" />Add Line</Button>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {lines.map((l, i) => {
                const t = lineTotals(l)
                return (
                  <div key={i} className="rounded-lg border border-border/50 p-3 space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Item</Label>
                        <Select value={l.itemId} onValueChange={v => {
                          const it = items.find(x => x.id === v)
                          updateLine(i, 'itemId', v)
                          if (it && !l.description) updateLine(i, 'description', itemDisplayName(it))
                        }}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Custom" /></SelectTrigger>
                          <SelectContent>{items.map(it => <SelectItem key={it.id} value={it.id}>{itemDisplayName(it)} ({it.sku})</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Description *</Label>
                        <Input className="h-7 text-xs" value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                      </div>
                      <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Qty</Label><Input type="number" className="h-7 text-xs" value={l.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Unit Price *</Label><Input type="number" step="0.01" className="h-7 text-xs" value={l.unitPrice} onChange={e => updateLine(i, 'unitPrice', e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Tax %</Label><Input type="number" step="0.01" className="h-7 text-xs" value={l.taxRate} onChange={e => updateLine(i, 'taxRate', e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Discount</Label><Input type="number" step="0.01" className="h-7 text-xs" value={l.discount} onChange={e => updateLine(i, 'discount', e.target.value)} /></div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">GL Account</Label>
                        <Select value={l.glAccountId} onValueChange={v => updateLine(i, 'glAccountId', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Warehouse</Label>
                        <Select value={l.warehouseId} onValueChange={v => updateLine(i, 'warehouseId', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end justify-between gap-1">
                        <span className="text-xs font-bold">{formatCurrency(t.total)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="sticky top-28 self-start">
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Cost Summary</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              {[
                ['Subtotal', subTotal], ['Tax', taxAmount], ['Discount', -discountAmount],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between text-xs"><span className="text-muted-foreground">{l}</span><span className="font-semibold">{formatCurrency(v as number)}</span></div>
              ))}
              <div className="border-t border-border/50 pt-2 flex justify-between"><span className="text-sm font-bold">Grand Total</span><span className="text-lg font-bold text-blue-600">{formatCurrency(grandTotal, currencyCode)}</span></div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Tax & Charges */}
      {step === 3 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card >
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4 text-amber-500" />Tax &amp; Charges</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              <div className="space-y-1.5"><Label className="text-xs font-semibold">Shipping Charges</Label><Input type="number" step="0.01" className="h-8 text-xs" value={shippingCharges} onChange={e => setShippingCharges(e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs font-semibold">Notes</Label><Textarea className="min-h-[80px] text-xs" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes about this invoice…" /></div>
            </CardContent>
          </Card>
          <Card >
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Cost Summary</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4 space-y-2">
              {[
                ['Subtotal', subTotal], ['Tax', taxAmount], ['Shipping', shipping], ['Discount', -discountAmount],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between text-xs"><span className="text-muted-foreground">{l}</span><span className="font-semibold">{formatCurrency(v as number)}</span></div>
              ))}
              <div className="border-t border-border/50 pt-2 flex justify-between"><span className="text-sm font-bold">Grand Total</span><span className="text-lg font-bold text-blue-600">{formatCurrency(grandTotal, currencyCode)}</span></div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 4: Verify & Submit */}
      {step === 4 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card >
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" />Verification</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              {poDetail ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 text-center"><p className="text-xs text-muted-foreground uppercase font-medium">Purchase Order</p><p className="mt-1 text-lg font-bold">{formatCurrency(poTotal ?? 0)}</p></div>
                    <div className="rounded-lg border p-3 text-center"><p className="text-xs text-muted-foreground uppercase font-medium">This Invoice</p><p className="mt-1 text-lg font-bold">{formatCurrency(grandTotal)}</p></div>
                  </div>
                  <div className={cn('rounded-md border px-4 py-2 text-sm font-medium flex items-center gap-2',
                    poMatch ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800')}>
                    {poMatch ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {poMatch ? 'Matched — invoice total agrees with PO.' : 'Mismatch — invoice total differs from PO value.'}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No purchase order referenced — matching will be marked pending review.</p>
              )}
              <div className="space-y-1.5"><Label className="text-xs font-semibold">Finance Notes</Label><Textarea className="min-h-[70px] text-xs" value={financeNotes} onChange={e => setFinanceNotes(e.target.value)} placeholder="Notes for finance/approval…" /></div>
            </CardContent>
          </Card>
          <Card >
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold">Invoice Summary</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4 space-y-2">
              {[
                ['Supplier', vendor?.name ?? '—'], ['Invoice Date', invoiceDate], ['Due Date', dueDate],
                ['PO Reference', pos.find(p => p.id === poId)?.poNumber ?? '—'], ['Line Items', String(lines.length)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-xs"><span className="text-muted-foreground">{l}</span><span className="font-medium">{v}</span></div>
              ))}
              <div className="border-t border-border/50 pt-2 flex justify-between"><span className="text-sm font-bold">Grand Total</span><span className="text-lg font-bold text-blue-600">{formatCurrency(grandTotal, currencyCode)}</span></div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sticky footer */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-background/95 backdrop-blur px-4 py-3">
        <Button type="button" variant="outline" className="text-xs h-8" onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}>
          {step === 0 ? 'Cancel' : '← Back'}
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-blue-600">{formatCurrency(grandTotal, currencyCode)}</span> total
        </div>
        {step < STEPS.length - 1 ? (
          <Button className="text-xs h-8" onClick={() => setStep(s => s + 1)} disabled={step === 0 && (!vendorId || !invoiceDate || !dueDate)}>
            Next →
          </Button>
        ) : (
          <Button className="text-xs h-8" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating…' : 'Submit Invoice'}
          </Button>
        )}
      </div>
    </div>
  )
}

export function PageClient(props: {
  vendors: Vendor[]
  pos: PO[]
  items: Item[]
  accounts: Account[]
  warehouses: Warehouse[]
  departments: Department[]
  costCentres: CostCentre[]
}) {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <PageContentForm {...props} />
    </Suspense>
  )
}
