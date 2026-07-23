'use client'

import { useState } from 'react'
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js'
import { api } from '@/lib/api-client'
import { formatGBP } from '@/lib/uk-locale'
import { Button } from '@/components/ui/button'
import { AlertCircle, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  amount: number
  onSuccess: (paymentIntentId: string, cardBrand?: string, last4?: string) => void
  onError: (msg: string) => void
}

function Field({
  label,
  focused,
  hasValue,
  error,
  children,
}: {
  label: string
  focused: boolean
  hasValue: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        className={cn(
          'relative rounded-lg border transition-all',
          error ? 'border-red-400' : focused ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200',
        )}
      >
        <label
          className={cn(
            'absolute left-3 pointer-events-none transition-all text-gray-500',
            focused || hasValue ? 'text-[10px] top-1.5' : 'text-sm top-3.5',
          )}
        >
          {label}
        </label>
        <div className="pt-5 pb-1.5 px-3 [&_.StripeElement]:w-full">{children}</div>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

export default function CardPaymentForm({ amount, onSuccess, onError }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState('')
  const [fields, setFields] = useState({ number: false, expiry: false, cvc: false })
  const [focus, setFocus] = useState<string | null>(null)

  const allComplete = fields.number && fields.expiry && fields.cvc

  const handlePay = async () => {
    if (!stripe || !elements || !allComplete) return
    setLoading(true)
    setError(null)

    try {
      const res = await api.post<{ clientSecret: string; paymentIntentId: string }>('/api/payments/stripe/create-intent', { amount })
      if (!res.success || !res.data) throw new Error(typeof res.error === 'string' ? res.error : 'Failed to create payment')

      const cardNumber = elements.getElement(CardNumberElement)
      if (!cardNumber) throw new Error('Card element not found')

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(res.data.clientSecret, {
        payment_method: { card: cardNumber },
      })

      if (confirmError) {
        setError(confirmError.message ?? 'Payment failed')
        onError(confirmError.message ?? 'Payment failed')
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        const card = (paymentIntent as unknown as { charges: { data: Array<{ payment_method_details: { card: { brand: string; last4: string } | null } | null }> } }).charges?.data[0]?.payment_method_details?.card
        onSuccess(paymentIntent.id, card?.brand, card?.last4)
      } else {
        const msg = `Payment status: ${paymentIntent?.status}`
        setError(msg)
        onError(msg)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed'
      setError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative space-y-4">
      {/* Processing overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/90 backdrop-blur-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-600" />
          <p className="mt-5 text-sm font-semibold text-gray-700">Processing Payment…</p>
          <p className="mt-1 text-xs text-gray-400">Please don&apos;t close this screen</p>
        </div>
      )}

      <Field label="Card Number" focused={focus === 'number'} hasValue={fields.number}>
        <CardNumberElement
          options={{
            showIcon: true,
            style: {
              base: {
                fontSize: '16px',
                color: '#1f2937',
                fontFamily: '"Inter", system-ui, sans-serif',
                '::placeholder': { color: '#9ca3af' },
              },
              invalid: { color: '#dc2626' },
            },
          }}
          onChange={(e) => {
            setFields((p) => ({ ...p, number: e.complete }))
            setCardBrand(e.brand !== 'unknown' ? e.brand : '')
          }}
          onFocus={() => setFocus('number')}
          onBlur={() => setFocus(null)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry" focused={focus === 'expiry'} hasValue={fields.expiry}>
          <CardExpiryElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#1f2937',
                  fontFamily: '"Inter", system-ui, sans-serif',
                  '::placeholder': { color: '#9ca3af' },
                },
                invalid: { color: '#dc2626' },
              },
            }}
            onChange={(e) => setFields((p) => ({ ...p, expiry: e.complete }))}
            onFocus={() => setFocus('expiry')}
            onBlur={() => setFocus(null)}
          />
        </Field>
        <Field label="CVC" focused={focus === 'cvc'} hasValue={fields.cvc}>
          <CardCvcElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#1f2937',
                  fontFamily: '"Inter", system-ui, sans-serif',
                  '::placeholder': { color: '#9ca3af' },
                },
                invalid: { color: '#dc2626' },
              },
            }}
            onChange={(e) => setFields((p) => ({ ...p, cvc: e.complete }))}
            onFocus={() => setFocus('cvc')}
            onBlur={() => setFocus(null)}
          />
        </Field>
      </div>

      {cardBrand && !loading && (
        <div className="flex items-center gap-1.5 rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
          <span className="font-medium capitalize text-gray-700">{cardBrand}</span>
          <span className="text-gray-300">|</span>
          <Lock className="h-3 w-3" />
          <span>Secured by Stripe</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 animate-shake">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
        <span className="text-sm font-medium text-gray-600">Total to pay</span>
        <span className="text-xl font-bold text-gray-900">{formatGBP(amount)}</span>
      </div>

      <Button
        className="h-14 w-full rounded-xl bg-emerald-600 text-base font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        disabled={!stripe || !elements || !allComplete || loading}
        onClick={handlePay}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Processing…
          </span>
        ) : (
          <span>Pay <span className="text-lg">{formatGBP(amount)}</span></span>
        )}
      </Button>
    </div>
  )
}
