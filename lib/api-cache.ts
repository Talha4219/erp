// In-memory TTL cache for reference / lookup API responses that are:
//   - identical across users within a company
//   - fetched on almost every page load
//   - change infrequently (admin-only updates)
//
// Usage in a route:
//   import { withCache, cacheControl } from '@/lib/api-cache'
//   export const GET = withAuth(async () => {
//     try {
//       return await withCache('uom', 3600, () => prisma.unitOfMeasure.findMany(...))
//     } catch { return apiErrorResponse(...) }
//   })
//
// The `POST / PUT / DELETE` handler for the same resource should call
//   invalidateCache('brand-')   // clear all keys starting with 'brand-'

// ─── Cache-Control header helpers ──────────────────────────────────────

export function cacheControl(ttlSeconds: number, scope: 'private' | 'public' = 'private') {
  return {
    'Cache-Control': `${scope}, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`,
  }
}

// ─── Bounded TTL cache ────────────────────────────────────────────────

interface CacheEntry { data: unknown; expiry: number }

class TTLCache {
  private store = new Map<string, CacheEntry>()
  private max: number

  constructor(maxEntries = 500) { this.max = maxEntries }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiry) { this.store.delete(key); return undefined }
    return entry.data as T
  }

  set(key: string, data: unknown, ttlMs: number): void {
    if (this.store.size >= this.max) {
      const first = this.store.keys().next().value
      if (first) this.store.delete(first)
    }
    this.store.set(key, { data, expiry: Date.now() + ttlMs })
  }

  /** Invalidate all entries whose key starts with `prefix`.
   *  Call from POST/PUT/DELETE handlers for the same resource family. */
  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key)
    }
  }

  /** Clear the entire cache (e.g. after a schema migration or seed). */
  clear(): void { this.store.clear() }

  get size() { return this.store.size }
}

export const apiCache = new TTLCache()

// ─── Convenience wrapper for GET routes ───────────────────────────────

import { NextResponse } from 'next/server'

/**
 * Check the in-memory cache first; if miss, call `fetch` then store the
 * result and return it with Cache-Control headers.
 * The cache key is prefixed with the resource name for bulk invalidation.
 */
export async function withCache<T>(
  resource: string,
  ttlSeconds: number,
  fetch: () => Promise<T>,
): Promise<NextResponse> {
  const cacheKey = `${resource}`
  const cached = apiCache.get<T>(cacheKey)
  if (cached) {
    return NextResponse.json(
      { success: true, data: cached },
      { headers: cacheControl(ttlSeconds) },
    )
  }

  const data = await fetch()
  apiCache.set(cacheKey, data, ttlSeconds * 1000)
  return NextResponse.json(
    { success: true, data },
    { headers: cacheControl(ttlSeconds) },
  )
}
