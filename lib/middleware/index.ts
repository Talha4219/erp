export { withAudit } from './audit'
export { withRateLimit } from './rate-limit'
export { withPermission, invalidatePermCache } from './permission'

import { NextRequest, NextResponse } from 'next/server'

type Handler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse>
type Middleware = (handler: Handler) => Handler

/** Compose multiple middleware wrappers left-to-right */
export function compose(...middlewares: Middleware[]) {
  return (handler: Handler): Handler =>
    middlewares.reduceRight((h, mw) => mw(h), handler)
}
