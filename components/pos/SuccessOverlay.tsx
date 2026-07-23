'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { formatGBP } from '@/lib/uk-locale'
import { Printer, CheckCircle2, CreditCard, Banknote, Wifi, Loader2 } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: {
    id: number
    grandTotalGbp: number
    vatAmountGbp: number
    change: number
    method: string
    discount: number
    lines: { name: string; qty: number; unit: number }[]
  } | null
  cardBrand?: string
  cardLast4?: string
  onPrintReceipt: () => void
  onNewSale: () => void
}

const METHOD_ICONS: Record<string, typeof CreditCard> = {
  Cash: Banknote,
  Card: CreditCard,
  Contactless: Wifi,
}

export default function SuccessOverlay({ open, onOpenChange, sale, cardBrand, cardLast4, onPrintReceipt, onNewSale }: Props) {
  const orderPending = sale?.id === 0

  useEffect(() => {
    if (!open || !sale) return
    const timer = setTimeout(() => {
      onOpenChange(false)
      onNewSale()
    }, 8000)
    return () => clearTimeout(timer)
  }, [open, sale, onOpenChange, onNewSale])

  if (!open || !sale) return null

  const MethodIcon = METHOD_ICONS[sale.method] ?? CreditCard

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-up">
      {/* Confetti particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute h-2 w-2 rounded-full"
            style={{
              backgroundColor: ['#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6'][i % 5],
              left: `${Math.random() * 100}%`,
              top: '-2%',
              animation: `confetti-fall ${1.5 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
        {/* Animated checkmark */}
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" style={{ animation: 'fade-up 0.4s ease-out' }} />
        </div>

        <h2 className="text-xl font-bold text-gray-900">Payment Successful</h2>

        {/* Card details for card payments */}
        {sale.method === 'Card' && cardBrand && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <CreditCard className="h-3.5 w-3.5" />
            {cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1)}{cardLast4 ? ` •••• ${cardLast4}` : ''}
          </div>
        )}

        <p className="mt-5 text-4xl font-bold tabular-nums text-emerald-600">{formatGBP(sale.grandTotalGbp)}</p>

        <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-gray-500">
          <MethodIcon className="h-4 w-4" />
          {orderPending ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Confirming order…
            </span>
          ) : (
            <span>Order #{sale.id} · {sale.method}</span>
          )}
        </div>

        <div className="mt-1 text-xs text-gray-400">
          VAT {formatGBP(sale.vatAmountGbp)}{sale.discount > 0 ? ` · Discount -${formatGBP(sale.discount)}` : ''}
        </div>

        {sale.change > 0 && (
          <div className="mt-4 rounded-xl bg-amber-50 py-3 text-amber-800">
            <p className="text-xs font-medium uppercase tracking-wide">Change due</p>
            <p className="text-2xl font-bold tabular-nums">{formatGBP(sale.change)}</p>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onPrintReceipt}>
            <Printer className="mr-2 h-4 w-4" /> Receipt
          </Button>
          <Button className="flex-1 bg-blue-600 text-base font-semibold hover:bg-blue-700" onClick={() => { onOpenChange(false); onNewSale() }}>
            New Sale
          </Button>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Auto-closing in a moment…
        </p>
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
        }
      `}</style>
    </div>
  )
}
