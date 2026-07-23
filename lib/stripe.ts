import Stripe from 'stripe'
import { CircuitBreaker } from '@/lib/circuit-breaker'

let _stripe: Stripe | undefined

// Lazy Stripe client — the env check and SDK construction are deferred
// until first use so that importing this module during `next build` does
// not throw when STRIPE_SECRET_KEY is absent in CI.
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('Missing STRIPE_SECRET_KEY — set it in .env or your deployment environment.')
    _stripe = new Stripe(key, { typescript: true, timeout: 10_000 })
  }
  return _stripe
}

// Shared circuit breaker for all server-side Stripe API calls.
// - 5 failures → OPEN
// - 30 s cooldown → HALF_OPEN (1 probe request)
// - Max 3 concurrent in-flight requests
export const stripeBreaker = new CircuitBreaker({
  name: 'stripe',
  failureThreshold: 5,
  cooldownPeriod: 30_000,
  timeout: 8_000,   // slightly tighter than the HTTP timeout
  maxConcurrent: 3,
  halfOpenMaxRequests: 1,
  onStateChange: (name, from, to) => {
    console.warn(`[circuit-breaker] ${name}: ${from} → ${to}`)
  },
})
