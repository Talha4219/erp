import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/authz'
import type { Role } from '@prisma/client'
import type { Session } from 'next-auth'
import { cookies } from 'next/headers'
import { decode } from 'next-auth/jwt'
import type { JWT } from 'next-auth/jwt'

// The real NextAuth Session shape (see types/next-auth.d.ts) — kept as an alias so
// callers of hasModuleAccess(session, ...) etc. get a session typed the same way
// auth() already returns it, just narrowed to non-null.
export type AuthedSession = Session

type AuthResult =
  | { ok: true; session: AuthedSession }
  | { ok: false; response: NextResponse }

const ROLE_HIERARCHY: Role[] = ['VIEWER', 'OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']

const SESSION_COOKIES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.session-token.0',
  '__Secure-next-auth.session-token.0',
]

function sessionFromToken(token: JWT): AuthedSession {
  return {
    user: {
      id: token.sub as string,
      name: (token.name as string) ?? null,
      email: (token.email as string) ?? null,
      image: null,
      role: token.role as Role,
      allowedModules: (token.allowedModules as string[] | null) ?? null,
      allowedSubmodules: (token.allowedSubmodules as Record<string, string[]> | null) ?? null,
    },
    expires: token.exp
      ? new Date((token.exp as number) * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  } as AuthedSession
}

async function decodeSessionFromCookie(cookieValue: string): Promise<AuthedSession | null> {
  try {
    const secret = process.env.AUTH_SECRET!
    if (!secret) return null
    const token = await decode({ token: cookieValue, secret, salt: 'session-token' })
    if (!token?.sub) return null
    return sessionFromToken(token)
  } catch {
    return null
  }
}

/**
 * Validates the session. Pattern:
 *   const auth = await requireSession()
 *   if (!auth.ok) return auth.response
 *
 * Falls back to decoding the JWT directly from the cookie when auth() returns
 * null (Edge vs Node.js runtime mismatch workaround).
 */
export async function requireSession(req?: NextRequest): Promise<AuthResult> {
  // Try auth() first (works in server components)
  const session = await auth()
  if (session?.user) {
    return { ok: true, session: session as AuthedSession }
  }

  // Fallback: decode JWT directly from the request cookie.
  // auth() returns null in API route handlers (Node.js runtime) even when
  // the middleware (Edge) verified the user — req.cookies bypasses this.
  try {
    if (req) {
      const c = req.cookies.get('next-auth.session-token')
        ?? req.cookies.get('__Secure-next-auth.session-token')
        ?? req.cookies.get('next-auth.session-token.0')
        ?? req.cookies.get('__Secure-next-auth.session-token.0')
      if (c) {
        const s = await decodeSessionFromCookie(c.value)
        if (s) return { ok: true, session: s }
      }
    }

    // Final fallback: cookies() from next/headers (server component context)
    const cookieStore = await cookies()
    const tokenCookie = cookieStore.getAll().find(c => SESSION_COOKIES.includes(c.name))
    if (tokenCookie) {
      const s = await decodeSessionFromCookie(tokenCookie.value)
      if (s) return { ok: true, session: s }
    }

    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  } catch {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }
}

/**
 * Validates the session AND that the user has at least the given role.
 */
export async function requireRole(minRole: Role, req?: NextRequest): Promise<AuthResult> {
  const result = await requireSession(req)
  if (!result.ok) return result

  const userLevel = ROLE_HIERARCHY.indexOf(result.session.user.role as Role)
  const requiredLevel = ROLE_HIERARCHY.indexOf(minRole)

  if (userLevel < requiredLevel) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Forbidden: insufficient permissions' }, { status: 403 }) }
  }
  return result
}

/**
 * Serializes errors safely — never exposes internal details in production.
 */
export function apiErrorResponse(err: unknown, fallback = 'An unexpected error occurred'): NextResponse {
  const isDev = process.env.NODE_ENV === 'development'
  const message = isDev && err instanceof Error ? err.message : fallback
  return NextResponse.json({ success: false, error: message }, { status: 500 })
}

/** @internal shared response for module-level forbidden */
const FORBIDDEN = NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

/**
 * Wraps a route handler with auth, module-permission, and error-catch logic.
 *
 * Usage:
 *   export const GET = withAuth(async (req, { session }) => {
 *     return NextResponse.json({ success: true, data: items })
 *   }, { module: 'inventory' })
 *
 * The wrapper:
 *   1. Validates the session (401 if missing)
 *   2. Checks role hierarchy if `opts.role` is provided (403 if insufficient)
 *   3. Checks module access if `opts.module` is provided (403 if denied)
 *   4. Catches thrown errors and returns a safe 500 response
 */
export function withAuth<C extends Record<string, unknown> = Record<string, unknown>>(
  handler: (req: NextRequest, ctx: C & { session: AuthedSession }) => Promise<NextResponse>,
  opts?: { role?: Role; module?: string }
) {
  return async (req: NextRequest, ctx?: C): Promise<NextResponse> => {
    const result = opts?.role ? await requireRole(opts.role, req) : await requireSession(req)
    if (!result.ok) return result.response
    if (opts?.module && !hasModuleAccess(result.session, opts.module)) return FORBIDDEN
    try {
      return await handler(req, { ...(ctx as C), session: result.session })
    } catch (err) {
      return apiErrorResponse(err)
    }
  }
}
