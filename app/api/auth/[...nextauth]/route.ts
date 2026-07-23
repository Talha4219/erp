import { handlers } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const { GET, POST: nextAuthPost } = handlers

// In-memory rate limiter for login — 5 attempts per minute per IP
const loginBuckets = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  const bucket = loginBuckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    loginBuckets.set(ip, { count: 1, resetAt: now + windowMs })
    return false
  }
  bucket.count++
  if (bucket.count > limit) return true
  return false
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many login attempts. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  return nextAuthPost(req)
}

export { GET }
