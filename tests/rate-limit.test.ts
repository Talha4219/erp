import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/middleware/rate-limit'

async function okHandler() {
  return NextResponse.json({ success: true })
}

function makeReq(ip: string): NextRequest {
  return new NextRequest('http://localhost:3000/test', {
    headers: { 'x-forwarded-for': ip },
  })
}

describe('withRateLimit', () => {
  it('allows requests under the limit', async () => {
    const wrapped = withRateLimit(okHandler, { limit: 100 })
    const res = await wrapped(makeReq('10.0.0.1'), {} as any)
    expect(res.status).toBe(200)
  })

  it('returns 429 when limit is exceeded', async () => {
    const wrapped = withRateLimit(okHandler, { limit: 100 })
    const ip = '10.0.0.2'

    // First request consumes all 100 tokens
    const first = await wrapped(makeReq(ip), {} as any)
    expect(first.status).toBe(200)

    // Second request should be blocked (0 < 100)
    const second = await wrapped(makeReq(ip), {} as any)
    expect(second.status).toBe(429)
    const body = await second.json()
    expect(body.error).toContain('Too many requests')
  })

  it('includes rate limit headers on 429', async () => {
    const wrapped = withRateLimit(okHandler, { limit: 100 })
    const ip = '10.0.0.3'

    await wrapped(makeReq(ip), {} as any)
    const res = await wrapped(makeReq(ip), {} as any)
    expect(res.status).toBe(429)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('different IPs have independent buckets', async () => {
    const wrapped = withRateLimit(okHandler, { limit: 100 })

    // Exhaust the bucket for ip A
    await wrapped(makeReq('10.0.0.10'), {} as any)
    const blocked = await wrapped(makeReq('10.0.0.10'), {} as any)
    expect(blocked.status).toBe(429)

    // ip B should still have a full bucket
    const allowed = await wrapped(makeReq('10.0.0.11'), {} as any)
    expect(allowed.status).toBe(200)
  })

  it('sets rate limit headers on successful responses', async () => {
    const wrapped = withRateLimit(okHandler, { limit: 50 })
    const res = await wrapped(makeReq('10.0.0.20'), {} as any)
    expect(res.status).toBe(200)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('50')
  })
})
