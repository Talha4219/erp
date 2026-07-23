import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const CORS_ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
].filter(Boolean)

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: https://va.vercel-scripts.com",
  "frame-src 'self' https://js.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Content-Security-Policy': CSP,
}

const publicRoutes = ['/login', '/unauthorized']
const publicApiRoutes = ['/api/auth', '/api/settings/public']

// Map first URL path segment → module name
// NOTE: 'dashboard' is intentionally excluded — every user always has access to their personal dashboard
const PATH_MODULE: Record<string, string> = {
  pos: 'pos',
  crm: 'crm',
  customers: 'customers',
  'business-partners': 'crm',
  sales: 'sales',
  procurement: 'procurement',
  inventory: 'inventory',
  finance: 'finance',
  hr: 'hr',
  reports: 'reports',
  settings: 'settings',
  audit: 'audit',
  workflow: 'workflow',
  documents: 'documents',
  projects: 'projects',
  expenses: 'expenses',
  fulfillment: 'fulfillment',
}

// Duplicated here so middleware (edge runtime) can check without importing from lib/utils
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['dashboard','hr','procurement','inventory','sales','finance','projects','reports','settings','pos','customers','expenses','crm','workflow','documents','audit','fulfillment'],
  MANAGER: ['dashboard','hr','procurement','inventory','sales','finance','projects','reports','pos','customers','expenses','crm','workflow','documents','fulfillment'],
  OPERATOR: ['dashboard','procurement','inventory','sales','pos','customers','expenses','crm','workflow','documents','fulfillment'],
  VIEWER: ['dashboard','reports','workflow'],
}

function withCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  if (origin && CORS_ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Vary', 'Origin')
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id')
  response.headers.set('Access-Control-Max-Age', '86400')
  return response
}

function withSecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

function adornResponse(response: NextResponse, req: NextRequest): NextResponse {
  withCorsHeaders(response, req.headers.get('origin'))
  withSecurityHeaders(response)
  return response
}

export default auth((req) => {
  const { nextUrl } = req
  const origin = req.headers.get('origin')

  // CORS preflight — respond before auth checks
  if (req.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 })
    withCorsHeaders(response, origin)
    return response
  }

  const isLoggedIn = !!req.auth
  const pathname = nextUrl.pathname

  const isPublicRoute = publicRoutes.some((r) => pathname.startsWith(r))
  const isPublicApiRoute = publicApiRoutes.some((r) => pathname.startsWith(r))

  if (isPublicApiRoute) return adornResponse(NextResponse.next(), req)

  if (isPublicRoute) {
    if (isLoggedIn && pathname.startsWith('/login'))
      return adornResponse(NextResponse.redirect(new URL('/dashboard', nextUrl)), req)
    return adornResponse(NextResponse.next(), req)
  }

  if (!isLoggedIn) {
    if (pathname.startsWith('/api/')) {
      return adornResponse(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
        req,
      )
    }
    return adornResponse(NextResponse.redirect(new URL('/login', nextUrl)), req)
  }

  // Module-level access check
  const segment = pathname.split('/')[1]
  const moduleName = PATH_MODULE[segment]
  if (moduleName) {
    const user = req.auth!.user as { role: string; allowedModules?: string[] | null }
    const { allowedModules, role } = user

    let hasAccess: boolean
    if (allowedModules != null) {
      const rolePerms = ROLE_PERMISSIONS[role] ?? []
      hasAccess = rolePerms.includes('*') || rolePerms.includes(moduleName) || allowedModules.includes(moduleName)
    } else {
      const perms = ROLE_PERMISSIONS[role] ?? []
      hasAccess = perms.includes('*') || perms.includes(moduleName)
    }

    if (!hasAccess) {
      if (pathname.startsWith('/api/')) {
        return adornResponse(
          NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
          req,
        )
      }
      return adornResponse(NextResponse.redirect(new URL('/unauthorized', nextUrl)), req)
    }
  }

  return adornResponse(NextResponse.next(), req)
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
