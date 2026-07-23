import { NextRequest, NextResponse } from 'next/server'

type Bucket = { tokens: number; lastRefill: number }

// In-memory token buckets — keyed by userId or IP
const buckets = new Map<string, Bucket>()

const REFILL_RATE = 10     // tokens per second
const MAX_TOKENS = 100     // burst capacity
const WINDOW_MS = 1000     // refill window in ms

function getTokens(key: string): Bucket {
  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket) {
    bucket = { tokens: MAX_TOKENS, lastRefill: now }
    buckets.set(key, bucket)
    return bucket
  }

  const elapsed = now - bucket.lastRefill
  const refill = Math.floor((elapsed / WINDOW_MS) * REFILL_RATE)
  if (refill > 0) {
    bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + refill)
    bucket.lastRefill = now
  }

  return bucket
}

// Prune stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - 5 * 60 * 1000
    Array.from(buckets.entries()).forEach(([key, bucket]) => {
      if (bucket.lastRefill < cutoff) buckets.delete(key)
    })
  }, 5 * 60 * 1000)
}

type Handler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse>

export function withRateLimit(handler: Handler, options?: { limit?: number }): Handler {
  const limit = options?.limit ?? 1

  return async (req: NextRequest, ctx?: unknown) => {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    const userId = req.headers.get('x-user-id') ?? ip
    const bucket = getTokens(userId)

    if (bucket.tokens < limit) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: {
            'Retry-After': '1',
            'X-RateLimit-Limit': String(MAX_TOKENS),
            'X-RateLimit-Remaining': String(bucket.tokens),
          },
        }
      )
    }

    bucket.tokens -= limit
    const response = await handler(req, ctx)

    response.headers.set('X-RateLimit-Limit', String(MAX_TOKENS))
    response.headers.set('X-RateLimit-Remaining', String(bucket.tokens))

    return response
  }
}
