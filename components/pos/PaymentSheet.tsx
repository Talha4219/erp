'use client'

import { useMemo } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatGBP } from '@/lib/uk-locale'
import { CreditCard, Banknote, Wifi, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import CardPaymentForm from './CardPaymentForm'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  grandTotal: number
  changeDue: number
  paymentMethod: 'Cash' | 'Card' | 'Contactless'
  setPaymentMethod: (m: 'Cash' | 'Card' | 'Contactless') => void
  tendered: string
  setTendered: (v: string) => void
  confirmPending: boolean
  onCompleteSale: () => void
  onCardSuccess: (paymentIntentId: string, cardBrand?: string, last4?: string) => void
}

const METHODS = [
  { key: 'Cash' as const, icon: Banknote, label: 'Cash' },
  { key: 'Card' as const, icon: CreditCard, label: 'Card' },
  { key: 'Contactless' as const, icon: Wifi, label: 'Contactless' },
]

export default function PaymentSheet({
  open, onOpenChange, grandTotal, changeDue,
  paymentMethod, setPaymentMethod,
  tendered, setTendered,
  confirmPending, onCompleteSale, onCardSuccess,
}: Props) {
  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (typeof window !== 'undefined' && key?.startsWith('pk_')) return loadStripe(key)
    return null
  }, [])

  const changeDueVal = Math.max(0, changeDue)
  const shortBy = Number(tendered) > 0 && changeDue < 0 ? Math.abs(changeDue) : 0

  const handleCardSuccess = (piId: string, brand?: string, last4?: string) => {
    onCardSuccess(piId, brand, last4)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md p-0">
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">Take Payment</SheetTitle>
            <button onClick={() => onOpenChange(false)} className="rounded-md p-1 text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          {/* Amount due */}
          <div className="rounded-xl bg-gray-900 py-5 text-center text-white">
            <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Amount Due</p>
            <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{formatGBP(grandTotal)}</p>
          </div>

          {/* Method selector */}
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setPaymentMethod(key)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-xs font-medium transition-all',
                  paymentMethod === key
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                )}
              >
                <Icon className={cn('h-6 w-6', paymentMethod === key ? 'text-blue-600' : 'text-gray-400')} />
                {label}
              </button>
            ))}
          </div>

          {/* Cash */}
          {paymentMethod === 'Cash' && (
            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <label className="text-sm font-medium text-gray-700">Amount tendered</label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !confirmPending && Number(tendered) >= grandTotal) {
                    onCompleteSale()
                  }
                }}
                className="h-12 bg-white text-xl font-bold tabular-nums"
                autoFocus
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Change due</span>
                <span className={cn(
                  'text-lg font-bold tabular-nums',
                  shortBy > 0 ? 'text-red-500' : 'text-emerald-600',
                )}>
                  {Number(tendered) > 0 ? formatGBP(changeDueVal) : '—'}
                </span>
              </div>
              {shortBy > 0 && (
                <p className="text-xs text-red-500">Short by {formatGBP(shortBy)}</p>
              )}
            </div>
          )}

          {/* Card */}
          {paymentMethod === 'Card' && stripePromise && (
            <div className="flex-1">
              <Elements stripe={stripePromise} key={open ? 'card' : 'hidden'}>
                <CardPaymentForm amount={grandTotal} onSuccess={handleCardSuccess} onError={() => {}} />
              </Elements>
            </div>
          )}
          {paymentMethod === 'Card' && !stripePromise && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Stripe is not configured. Check your environment variables.
            </div>
          )}

          {/* Contactless */}
          {paymentMethod === 'Contactless' && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              <Wifi className="mb-3 h-12 w-12 text-blue-500" />
              <p className="text-sm font-medium text-gray-700">Tap or wave card / phone</p>
              <p className="mt-1 text-xs text-gray-400">Contactless payment terminal</p>
              <Button
                className="mt-6 h-14 w-full rounded-xl bg-emerald-600 text-base font-bold hover:bg-emerald-700"
                disabled={confirmPending}
                onClick={onCompleteSale}
              >
                {confirmPending ? 'Processing…' : `Complete Sale · ${formatGBP(grandTotal)}`}
              </Button>
            </div>
          )}
        </div>

        {/* Footer for Cash / Contactless */}
        {paymentMethod !== 'Card' && (
          <div className="border-t px-5 py-4">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="h-12 flex-1 bg-emerald-600 text-base font-bold hover:bg-emerald-700"
                disabled={confirmPending || (paymentMethod === 'Cash' && Number(tendered) > 0 && changeDue < 0)}
                onClick={onCompleteSale}
              >
                {confirmPending ? 'Processing…' : `Pay ${formatGBP(grandTotal)}`}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
