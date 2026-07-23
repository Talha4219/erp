'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api-client'
import { formatGBP } from '@/lib/uk-locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  ShoppingCart, Trash2, X, RotateCcw, ScanBarcode,
  PauseCircle, PlayCircle, User, Clock, Minus, Plus, Percent,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import PaymentSheet from '@/components/pos/PaymentSheet'
import SuccessOverlay from '@/components/pos/SuccessOverlay'
import { playScanBeep, playSuccessChime } from '@/components/pos/sounds'

// POS sells inventory Items directly. Stock lives in warehouseStock, not batches.
type Item = {
  id: string
  sku: string
  barcode: string | null
  secondaryBarcode: string | null
  name: string
  packing: string | null
  category: { name: string } | null
  sellingPrice: string
  vatRate: string
  isActive: boolean
  isSellable: boolean
  warehouseStocks: Array<{ quantity: string; warehouse: { id: string; name: string } }>
}

type BasketItem = {
  itemId: string
  itemName: string
  quantity: number
  unitPriceGbp: number
  vatRateApplied: number
  inStock: number
}

type RetailCustomer = { id: string; firstName: string; lastName: string; name: string; loyaltyPointsBalance: number }

type HeldSale = {
  id: string
  heldAt: string
  basket: BasketItem[]
  customer: RetailCustomer | null
}

type ReturnLine = {
  id: string
  quantity: number
  unitPriceGbp: string
  lineDiscountGbp: string
  vatRateApplied: string
  item: { name: string } | null
  product: { productName: string } | null
  returns: Array<{ quantityReturned: number }>
}
type ReturnOrder = {
  id: string
  grandTotalGbp: string
  lineItems: ReturnLine[]
}

const RETURN_REASONS = ['Damaged', 'Wrong Item', 'Defective', 'Customer Return'] as const
const QUICK_DISCOUNTS = [5, 10, 15, 20] as const

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// Units still returnable on a line = sold minus everything already returned.
function returnableQty(line: ReturnLine) {
  return line.quantity - line.returns.reduce((s, r) => s + r.quantityReturned, 0)
}
// Gross (incl. VAT) refund per unit, net of the line's per-unit discount share.
function unitRefund(line: ReturnLine) {
  const unitDiscount = line.quantity > 0 ? Number(line.lineDiscountGbp) / line.quantity : 0
  return (Number(line.unitPriceGbp) - unitDiscount) * (1 + Number(line.vatRateApplied))
}

// Name to show for a sold line — the inventory Item, or a legacy retail Product.
function lineName(line: ReturnLine) {
  return line.item?.name ?? line.product?.productName ?? 'Item'
}

// Total sellable stock for an Item across all its warehouses.
function itemStock(item: Item) {
  return item.warehouseStocks.reduce((s, ws) => s + Number(ws.quantity), 0)
}

// Deterministic accent colour for product-card initials tiles.
const TILE_COLORS = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700']
function tileColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return TILE_COLORS[Math.abs(h) % TILE_COLORS.length]
}

export default function PosPage() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const scanRef = useRef<HTMLInputElement>(null)
  const stripePiRef = useRef<string | null>(null)

  const [darkMode, setDarkMode] = useState(false)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [basket, setBasket] = useState<BasketItem[]>([])
  const [customerEmail, setCustomerEmail] = useState('')
  const [linkedCustomer, setLinkedCustomer] = useState<RetailCustomer | null>(null)

  // Invoice-level discount (distributed across lines when submitting)
  const [discountPct, setDiscountPct] = useState(0)
  const [discountAmt, setDiscountAmt] = useState('')

  // Payment flow
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Contactless'>('Card')
  const [tendered, setTendered] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastSale, setLastSale] = useState<{
    id: number; grandTotalGbp: number; vatAmountGbp: number; change: number
    method: string; lines: Array<{ name: string; qty: number; unit: number }>
    discount: number
  } | null>(null)
  const [cardPaymentDetails, setCardPaymentDetails] = useState<{ brand?: string; last4?: string }>({})

  // Hold / resume
  const [heldSales, setHeldSales] = useState<HeldSale[]>([])
  const [showHeld, setShowHeld] = useState(false)

  // Returns
  const [showReturn, setShowReturn] = useState(false)
  const [returnOrderId, setReturnOrderId] = useState('')
  const [lookupId, setLookupId] = useState<string | null>(null)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [returnQty, setReturnQty] = useState(1)
  const [returnReason, setReturnReason] = useState('')

  // Live clock in the top bar
  const [clock, setClock] = useState('')
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const t = setInterval(tick, 15_000)
    return () => clearInterval(t)
  }, [])

  // Held sales survive an accidental refresh
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pos-held-sales')
      if (raw) setHeldSales(JSON.parse(raw))
    } catch { /* corrupt store — start fresh */ }
  }, [])
  useEffect(() => {
    localStorage.setItem('pos-held-sales', JSON.stringify(heldSales))
  }, [heldSales])

  // ── Product catalog: fetched once and cached, so scans and searches are local
  //    (no round trip per keystroke or per scan).
  const { data: catalogData } = useQuery({
    queryKey: ['pos-catalog'],
    queryFn: () => api.get<Item[]>('/api/inventory/items').then((r) => r.data ?? []),
    staleTime: 60_000,
    refetchInterval: 120_000, // keep prices/stock reasonably fresh during a shift
  })
  const catalog = useMemo(
    () => (catalogData ?? []).filter((i) => i.isActive && i.isSellable),
    [catalogData],
  )

  const categories = useMemo(() => {
    const names = new Set<string>()
    for (const i of catalog) if (i.category?.name) names.add(i.category.name)
    return Array.from(names).sort()
  }, [catalog])

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalog.filter((i) => {
      if (category && i.category?.name !== category) return false
      if (!q) return true
      return (
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        (i.barcode ?? '').toLowerCase().includes(q)
      )
    })
  }, [catalog, search, category])

  const { data: customerData } = useQuery({
    queryKey: ['retail-customer-lookup', customerEmail],
    queryFn: () =>
      api.get<RetailCustomer[]>(`/api/retail/customers?search=${encodeURIComponent(customerEmail)}`).then((r) => r.data ?? []),
    enabled: customerEmail.length >= 3,
  })

  const focusScan = useCallback(() => {
    // Next tick — dialogs steal focus while closing
    setTimeout(() => scanRef.current?.focus(), 50)
  }, [])

  const addToBasket = useCallback((item: Item) => {
    const stock = itemStock(item)
    if (stock <= 0) { toast.error('No stock available'); return }
    playScanBeep()

    setBasket((prev) => {
      const existing = prev.find((b) => b.itemId === item.id)
      if (existing) {
        if (existing.quantity >= stock) { toast.error('Insufficient stock'); return prev }
        return prev.map((b) => b.itemId === item.id ? { ...b, quantity: b.quantity + 1 } : b)
      }
      return [...prev, {
        itemId: item.id,
        itemName: item.packing ? `${item.name} (${item.packing})` : item.name,
        quantity: 1,
        unitPriceGbp: Number(item.sellingPrice),
        vatRateApplied: Number(item.vatRate),
        inStock: stock,
      }]
    })
    setSearch('')
    focusScan()
  }, [focusScan])

  // Hardware scanners type the code and send Enter. Resolve against the local
  // catalog first (instant), fall back to the API for exact-match lookup.
  // Priority: barcode → secondary barcode → SKU.
  const handleScan = useCallback(async (code: string) => {
    if (!code) return
    const local =
      catalog.find((i) => i.barcode === code) ??
      catalog.find((i) => i.secondaryBarcode === code) ??
      catalog.find((i) => i.sku === code)
    if (local) { addToBasket(local); return }

    const res = await api.get<Item[]>(`/api/inventory/items?barcode=${encodeURIComponent(code)}`)
    const matches = (res.data ?? []).filter((i) => i.isActive && i.isSellable)
    const item =
      matches.find((i) => i.barcode === code) ??
      matches.find((i) => i.secondaryBarcode === code) ??
      matches.find((i) => i.sku === code)
    if (item) {
      addToBasket(item) // repeated scans of the same code bump the quantity
    } else {
      toast.error(`Barcode not found: ${code}`)
      setSearch('')
    }
  }, [catalog, addToBasket])

  const removeFromBasket = (itemId: string) => {
    setBasket((prev) => prev.filter((b) => b.itemId !== itemId))
    focusScan()
  }

  const updateQty = (itemId: string, delta: number) => {
    setBasket((prev) => prev
      .map((b) => b.itemId === itemId
        ? { ...b, quantity: Math.max(1, Math.min(b.inStock, b.quantity + delta)) }
        : b)
    )
  }

  // ── Totals. The invoice discount is spread across lines proportionally by
  //    line value (the server only accepts per-line discounts), so this preview
  //    matches exactly what the server will record.
  const { discountedLines, grossTotal, discountTotal, vatAmount, grandTotal } = useMemo(() => {
    const gross = round2(basket.reduce((s, li) => s + li.quantity * li.unitPriceGbp, 0))
    const target = discountPct > 0
      ? round2(gross * (discountPct / 100))
      : Math.min(round2(Number(discountAmt) || 0), gross)

    let remaining = target
    const lines = basket.map((li, idx) => {
      const lineGross = round2(li.quantity * li.unitPriceGbp)
      const share = idx === basket.length - 1
        ? Math.min(remaining, lineGross)
        : Math.min(round2(gross > 0 ? target * (lineGross / gross) : 0), lineGross)
      remaining = round2(remaining - share)
      return { ...li, lineDiscountGbp: share, lineNet: round2(lineGross - share) }
    })

    const net = round2(lines.reduce((s, l) => s + l.lineNet, 0))
    const vat = round2(lines.reduce((s, l) => s + round2(l.lineNet * l.vatRateApplied), 0))
    return {
      discountedLines: lines,
      grossTotal: gross,
      discountTotal: round2(gross - net),
      netTotal: net,
      vatAmount: vat,
      grandTotal: round2(net + vat),
    }
  }, [basket, discountPct, discountAmt])

  const changeDue = round2((Number(tendered) || 0) - grandTotal)

  const resetSale = useCallback(() => {
    setBasket([])
    setLinkedCustomer(null)
    setCustomerEmail('')
    setDiscountPct(0)
    setDiscountAmt('')
    setTendered('')
    setPaymentMethod('Card')
    stripePiRef.current = null
    setCardPaymentDetails({})
    focusScan()
  }, [focusScan])

  const confirmMutation = useMutation({
    // Server recomputes prices, VAT and totals from the Item records — we send
    // only the basket contents, so client-side figures can't drive the recorded sale.
    mutationFn: async () => {
      const res = await api.post<{ id: number; grandTotalGbp: number; vatAmountGbp: number }>('/api/retail/pos', {
        customerId: linkedCustomer?.id,
        paymentMethod,
        stripePaymentIntentId: stripePiRef.current ?? undefined,
        lineItems: discountedLines.map((li) => ({
          itemId: li.itemId,
          quantity: li.quantity,
          lineDiscountGbp: li.lineDiscountGbp,
        })),
      })
      if (!res.success || !res.data) throw new Error(typeof res.error === 'string' ? res.error : 'Sale failed')
      return res.data
    },
    onSuccess: (data) => {
      // For card payments, success overlay is already showing — just update order ID
      // For cash/contactless, show it for the first time
      setLastSale((prev) => prev && paymentMethod === 'Card' ? {
        ...prev,
        id: data.id,
        grandTotalGbp: Number(data.grandTotalGbp),
        vatAmountGbp: Number(data.vatAmountGbp),
      } : {
        id: data.id,
        grandTotalGbp: Number(data.grandTotalGbp),
        vatAmountGbp: Number(data.vatAmountGbp),
        change: paymentMethod === 'Cash' && Number(tendered) > 0 ? Math.max(0, changeDue) : 0,
        method: paymentMethod,
        discount: discountTotal,
        lines: discountedLines.map((l) => ({ name: l.itemName, qty: l.quantity, unit: l.unitPriceGbp })),
      })
      setShowPayment(false)
      setShowSuccess(true)
      resetSale()
      qc.invalidateQueries({ queryKey: ['pos-catalog'] }) // stock changed
      if (paymentMethod !== 'Card') playSuccessChime()
    },
    onError: (err: Error) => toast.error(err.message || 'Sale failed'),
  })

  const holdSale = () => {
    if (basket.length === 0) return
    setHeldSales((prev) => [...prev, {
      id: String(Date.now()),
      heldAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      basket,
      customer: linkedCustomer,
    }])
    resetSale()
    toast.success('Sale held — serve the next customer')
  }

  const resumeSale = (h: HeldSale) => {
    if (basket.length > 0) { toast.error('Finish or hold the current sale first'); return }
    setBasket(h.basket)
    setLinkedCustomer(h.customer)
    setHeldSales((prev) => prev.filter((x) => x.id !== h.id))
    setShowHeld(false)
    focusScan()
  }

  const printReceipt = () => {
    if (!lastSale) return
    const win = window.open('', '_blank', 'width=380,height=600')
    if (!win) { toast.error('Allow pop-ups to print receipts'); return }
    const rows = lastSale.lines.map((l) =>
      `<tr><td>${l.name}</td><td class="r">${l.qty}</td><td class="r">${formatGBP(l.unit)}</td><td class="r">${formatGBP(l.qty * l.unit)}</td></tr>`
    ).join('')
    win.document.write(`<!doctype html><html><head><title>Receipt #${lastSale.id}</title><style>
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 12px 0; }
      h2 { text-align: center; margin: 0 0 2px; font-size: 15px; }
      .c { text-align: center; margin: 2px 0; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      td { padding: 2px 0; } .r { text-align: right; }
      .tot { border-top: 1px dashed #000; font-weight: bold; }
      .grand { font-size: 15px; }
    </style></head><body>
      <h2>SALES RECEIPT</h2>
      <p class="c">Order #${lastSale.id}</p>
      <p class="c">${new Date().toLocaleString('en-GB')}</p>
      <table>
        ${rows}
        ${lastSale.discount > 0 ? `<tr class="tot"><td colspan="3">Discount</td><td class="r">-${formatGBP(lastSale.discount)}</td></tr>` : ''}
        <tr class="tot"><td colspan="3">VAT</td><td class="r">${formatGBP(lastSale.vatAmountGbp)}</td></tr>
        <tr class="tot grand"><td colspan="3">TOTAL</td><td class="r">${formatGBP(lastSale.grandTotalGbp)}</td></tr>
        <tr><td colspan="3">Paid — ${lastSale.method}</td><td class="r"></td></tr>
        ${lastSale.change > 0 ? `<tr><td colspan="3">Change</td><td class="r">${formatGBP(lastSale.change)}</td></tr>` : ''}
      </table>
      <p class="c">Thank you for your purchase!</p>
    </body></html>`)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  const { data: returnOrder, isLoading: returnOrderLoading, refetch: refetchReturnOrder } = useQuery({
    queryKey: ['retail-order', lookupId],
    queryFn: () => api.get<ReturnOrder>(`/api/retail/pos?orderId=${lookupId}`).then((r) => r.data),
    enabled: lookupId != null,
  })

  const selectedLine = returnOrder?.lineItems.find((l) => l.id === selectedLineId) ?? null

  const resetReturn = () => {
    setReturnOrderId(''); setLookupId(null); setSelectedLineId(null); setReturnQty(1); setReturnReason('')
  }

  const returnMutation = useMutation({
    // refundAmountGbp is computed server-side from the original line; we only send
    // which order/line, how many units, and the reason.
    mutationFn: (data: { originalOrderId: string; originalLineId: string; quantityReturned: number; reason: string }) =>
      api.post('/api/retail/pos/return', data),
    onSuccess: () => {
      toast.success('Return processed')
      refetchReturnOrder()          // refresh returnable quantities
      setSelectedLineId(null); setReturnQty(1); setReturnReason('')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to process return'),
  })

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-b bg-gray-900 px-4 py-2.5 text-white">
        <ShoppingCart className="h-6 w-6 text-blue-400" />
        <div>
          <span className="text-base font-bold leading-none">Point of Sale</span>
          <p className="text-[11px] leading-none text-gray-400">Register 1</p>
        </div>
        <div className="flex-1" />
        <div className="hidden items-center gap-1.5 text-sm text-gray-300 sm:flex">
          <User className="h-4 w-4" />
          {session?.user?.name ?? 'Cashier'}
        </div>
        <div className="hidden items-center gap-1.5 text-sm text-gray-300 sm:flex">
          <Clock className="h-4 w-4" />
          {clock}
        </div>
        <Button variant="outline" size="sm" className="border-gray-600 text-black" onClick={() => setShowHeld(true)}>
          <PauseCircle className="mr-1 h-4 w-4" /> Held
          {heldSales.length > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-black">{heldSales.length}</span>}
        </Button>
        <Button variant="outline" size="sm" className="border-gray-600 text-black" onClick={() => setShowReturn(true)}>
          <RotateCcw className="mr-1 h-4 w-4" /> Return
        </Button>
        <button
          onClick={() => setDarkMode((p) => !p)}
          className="rounded-lg border border-gray-600 p-1.5 text-gray-300 hover:bg-gray-700"
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <span className="text-sm">☀️</span> : <span className="text-sm">🌙</span>}
        </button>
      </div>

      {/* ── Scan bar — always focused, Enter = instant add ──────────────── */}
      <div className="border-b bg-white px-4 py-3 shadow-sm">
        <div className="relative mx-auto max-w-3xl">
          <ScanBarcode className="absolute left-4 top-3.5 h-6 w-6 text-blue-600" />
          <Input
            ref={scanRef}
            placeholder="Scan barcode or search product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              // Barcode scanners terminate with Enter — resolve and add instantly
              if (e.key === 'Enter') { e.preventDefault(); handleScan(search.trim()) }
              if (e.key === 'Escape') setSearch('')
            }}
            className="h-12 rounded-xl pl-12 text-lg shadow-none"
            autoFocus
          />
        </div>
      </div>

      {/* ── Main: products (60%) | cart (40%) ───────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* Product area */}
        <div className="flex min-w-0 flex-[3] flex-col">
          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto border-b bg-white px-4 py-2">
            <button
              onClick={() => setCategory('')}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${category === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              All Products
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? '' : c)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${category === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {visibleItems.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-gray-400">
                <ScanBarcode className="mb-2 h-10 w-10" />
                <p className="text-sm">{catalog.length === 0 ? 'Loading products…' : 'No products match'}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleItems.map((it) => {
                const stock = itemStock(it)
                const out = stock <= 0
                return (
                  <button
                    key={it.id}
                    onClick={() => addToBasket(it)}
                    disabled={out}
                    className="group flex flex-col rounded-xl border bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className={`mb-2 flex h-14 w-full items-center justify-center rounded-lg text-2xl font-bold ${tileColor(it.name)}`}>
                      {it.name.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="line-clamp-2 text-sm font-medium leading-tight">
                      {it.name}{it.packing && <span className="text-gray-400"> ({it.packing})</span>}
                    </p>
                    <div className="mt-auto flex items-end justify-between pt-1.5">
                      <span className="text-base font-bold text-blue-700">{formatGBP(it.sellingPrice)}</span>
                      <span className={`text-[11px] font-medium ${out ? 'text-red-500' : stock <= 5 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {out ? 'Out' : `${stock.toFixed(0)} in stock`}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Cart area */}
        <div className="flex w-full max-w-md flex-[2] flex-col border-l bg-white">
          {/* Customer */}
          <div className="border-b bg-blue-50/60 px-3 py-2">
            {!linkedCustomer ? (
              <div>
                <Input
                  placeholder="Customer phone / email (optional — walk-in)"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="h-9 bg-white"
                />
                {customerData && customerData.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {customerData.slice(0, 3).map((c) => (
                      <Button key={c.id} size="sm" variant="secondary" className="h-7 text-xs"
                        onClick={() => { setLinkedCustomer(c); setCustomerEmail(''); focusScan() }}>
                        {c.firstName} {c.lastName} ({c.loyaltyPointsBalance} pts)
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {linkedCustomer.firstName[0]}{linkedCustomer.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-none">{linkedCustomer.firstName} {linkedCustomer.lastName}</p>
                    <p className="text-xs text-gray-500">{linkedCustomer.loyaltyPointsBalance} loyalty points</p>
                  </div>
                </div>
                <button onClick={() => setLinkedCustomer(null)}><X className="h-4 w-4 text-gray-400" /></button>
              </div>
            )}
          </div>

          {/* Cart lines */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3">
            {basket.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-gray-300">
                <ShoppingCart className="mb-2 h-12 w-12" />
                <p className="text-sm">Scan a product to start</p>
              </div>
            )}
            {basket.map((item) => (
              <div key={item.itemId} className="flex items-center gap-2 border-b py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.itemName}</p>
                  <p className="text-xs text-gray-400">
                    {formatGBP(item.unitPriceGbp)} · VAT {(item.vatRateApplied * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => updateQty(item.itemId, -1)}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-7 text-center text-base font-bold tabular-nums">{item.quantity}</span>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => updateQty(item.itemId, 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="w-16 text-right text-sm font-semibold tabular-nums">
                  {formatGBP(item.quantity * item.unitPriceGbp)}
                </p>
                <button className="p-1 text-red-400 hover:text-red-600" onClick={() => removeFromBasket(item.itemId)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Sticky summary + actions */}
          <div className="border-t bg-gray-50 p-3">
            {/* Quick discounts */}
            <div className="mb-2 flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-gray-400" />
              {QUICK_DISCOUNTS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setDiscountPct(discountPct === p ? 0 : p); setDiscountAmt('') }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${discountPct === p ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:border-blue-400'
                    }`}
                >
                  {p}%
                </button>
              ))}
              <Input
                placeholder="£ off"
                value={discountAmt}
                onChange={(e) => { setDiscountAmt(e.target.value.replace(/[^0-9.]/g, '')); setDiscountPct(0) }}
                className="h-7 w-20 bg-white text-xs"
              />
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span className="tabular-nums">{formatGBP(grossTotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount{discountPct > 0 ? ` (${discountPct}%)` : ''}</span>
                  <span className="tabular-nums">−{formatGBP(discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>VAT</span><span className="tabular-nums">{formatGBP(vatAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 text-2xl font-bold">
                <span>Total</span><span className="tabular-nums text-emerald-700">{formatGBP(grandTotal)}</span>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                className="h-16 flex-1 flex-col gap-0.5"
                disabled={basket.length === 0}
                onClick={holdSale}
              >
                <PauseCircle className="h-5 w-5" />
                <span className="text-xs">Hold</span>
              </Button>
              <Button
                className="h-16 flex-[3] bg-emerald-600 text-xl font-bold hover:bg-emerald-700"
                disabled={basket.length === 0}
                onClick={() => { setTendered(''); setShowPayment(true) }}
              >
                PAY NOW · {formatGBP(grandTotal)}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment Sheet (slides from right) ──────────────────────────── */}
      <PaymentSheet
        open={showPayment}
        onOpenChange={(o) => { setShowPayment(o); if (!o) focusScan() }}
        grandTotal={grandTotal}
        changeDue={changeDue}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        tendered={tendered}
        setTendered={setTendered}
        confirmPending={confirmMutation.isPending}
        onCompleteSale={() => confirmMutation.mutate()}
        onCardSuccess={(piId, brand, last4) => {
          stripePiRef.current = piId
          setCardPaymentDetails({ brand, last4 })
          // Show success overlay immediately — don't wait for order API
          setLastSale({
            id: 0,
            grandTotalGbp: grandTotal,
            vatAmountGbp: vatAmount,
            change: 0,
            method: 'Card',
            discount: discountTotal,
            lines: discountedLines.map((l) => ({ name: l.itemName, qty: l.quantity, unit: l.unitPriceGbp })),
          })
          setShowPayment(false)
          setShowSuccess(true)
          resetSale()
          playSuccessChime()
          // Create order in background
          confirmMutation.mutate()
        }}
      />

      {/* ── Success Overlay ────────────────────────────────────────────── */}
      <SuccessOverlay
        open={showSuccess}
        onOpenChange={setShowSuccess}
        sale={lastSale}
        cardBrand={cardPaymentDetails.brand}
        cardLast4={cardPaymentDetails.last4}
        onPrintReceipt={printReceipt}
        onNewSale={() => focusScan()}
      />

      {/* ── Held sales dialog ───────────────────────────────────────────── */}
      <Dialog open={showHeld} onOpenChange={setShowHeld}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Held Sales</DialogTitle></DialogHeader>
          {heldSales.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No held sales</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {heldSales.map((h) => {
                const total = h.basket.reduce((s, li) => s + li.quantity * li.unitPriceGbp * (1 + li.vatRateApplied), 0)
                return (
                  <div key={h.id} className="flex items-center justify-between rounded-lg border p-2.5">
                    <div>
                      <p className="text-sm font-medium">
                        {h.basket.length} item{h.basket.length !== 1 ? 's' : ''} · {formatGBP(total)}
                      </p>
                      <p className="text-xs text-gray-400">
                        Held at {h.heldAt}{h.customer ? ` · ${h.customer.firstName} ${h.customer.lastName}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => resumeSale(h)}>
                        <PlayCircle className="mr-1 h-4 w-4" />Resume
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500"
                        onClick={() => setHeldSales((prev) => prev.filter((x) => x.id !== h.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Return dialog ───────────────────────────────────────────────── */}
      <Dialog open={showReturn} onOpenChange={(o) => { setShowReturn(o); if (!o) { resetReturn(); focusScan() } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Process Return / Refund</DialogTitle></DialogHeader>

          <div className="space-y-4">
            {/* Step 1: find the order */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-sm font-medium">Order ID</label>
                <Input
                  value={returnOrderId}
                  onChange={(e) => setReturnOrderId(e.target.value)}
                  placeholder="Order number"
                  onKeyDown={(e) => { if (e.key === 'Enter' && returnOrderId.trim()) { setSelectedLineId(null); setLookupId(returnOrderId.trim()) } }}
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => { if (returnOrderId.trim()) { setSelectedLineId(null); setLookupId(returnOrderId.trim()) } else toast.error('Enter a valid order id') }}
              >
                Find
              </Button>
            </div>

            {returnOrderLoading && <p className="text-sm text-gray-400">Loading order…</p>}
            {lookupId != null && !returnOrderLoading && !returnOrder && (
              <p className="text-sm text-red-500">Order #{lookupId} not found.</p>
            )}

            {/* Step 2: pick a line */}
            {returnOrder && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Order #{returnOrder.id} — select an item</p>
                <div className="max-h-56 divide-y overflow-y-auto rounded-md border">
                  {returnOrder.lineItems.map((line) => {
                    const remaining = returnableQty(line)
                    const disabled = remaining <= 0
                    return (
                      <button
                        key={line.id}
                        disabled={disabled}
                        onClick={() => { setSelectedLineId(line.id); setReturnQty(Math.min(1, remaining) || 1) }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-blue-50'
                          } ${selectedLineId === line.id ? 'bg-blue-100' : ''}`}
                      >
                        <div>
                          <p className="font-medium">{lineName(line)}</p>
                          <p className="text-xs text-gray-400">
                            Sold {line.quantity} · {formatGBP(unitRefund(line))} each incl. VAT
                          </p>
                        </div>
                        <Badge className={disabled ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-800'}>
                          {remaining} returnable
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 3: quantity + reason */}
            {selectedLine && (
              <div className="space-y-3 border-t pt-3">
                <div className="flex gap-3">
                  <div className="w-28">
                    <label className="text-sm font-medium">Return qty</label>
                    <Input
                      type="number"
                      min={1}
                      max={returnableQty(selectedLine)}
                      value={returnQty}
                      onChange={(e) => {
                        const max = returnableQty(selectedLine)
                        const v = Math.max(1, Math.min(max, parseInt(e.target.value) || 1))
                        setReturnQty(v)
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium">Reason</label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                    >
                      <option value="">Select a reason…</option>
                      {RETURN_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                  <span className="text-gray-500">Estimated refund</span>
                  <span className="font-semibold text-green-700">{formatGBP(unitRefund(selectedLine) * returnQty)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReturn(false); resetReturn() }}>Cancel</Button>
            <Button
              disabled={!selectedLine || !returnReason || returnMutation.isPending}
              onClick={() => {
                if (!returnOrder || !selectedLine || !returnReason) { toast.error('Select an item and reason'); return }
                returnMutation.mutate({
                  originalOrderId: returnOrder.id,
                  originalLineId: selectedLine.id,
                  quantityReturned: returnQty,
                  reason: returnReason,
                })
              }}
            >
              {returnMutation.isPending ? 'Processing…' : 'Process Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
