import { NextRequest, NextResponse } from 'next/server'
import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'

type Handler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse>

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function inferEntity(pathname: string): string {
  const segments = pathname.replace('/api/', '').split('/')
  const parts = segments
    .filter((s) => s && !s.startsWith('[') && s !== 'api')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()))
  return parts.join('')
}

function inferAction(method: string, hasId: boolean): string {
  switch (method) {
    case 'POST': return 'CREATE'
    case 'PUT':
    case 'PATCH': return hasId ? 'UPDATE' : 'CREATE'
    case 'DELETE': return 'DELETE'
    default: return method
  }
}

export function withAudit(handler: any, entity?: string): Handler {
  return async (req: NextRequest, ctx?: unknown) => {
    const method = req.method.toUpperCase()

    if (!MUTATION_METHODS.has(method)) {
      return handler(req, ctx)
    }

    const response = await handler(req, ctx)

    if (response.status < 200 || response.status >= 300) {
      return response
    }

    try {
      const { auth } = await import('@/lib/auth')
      const session: Session | null = await auth()
      if (!session?.user?.id) return response

      const pathname = new URL(req.url).pathname
      const entityName = entity ?? inferEntity(pathname)
      const ctxParams = (ctx as { params?: Record<string, string> })?.params
      const entityId = ctxParams?.id ?? 'bulk'
      const action = inferAction(method, !!ctxParams?.id)

      let newValues: Record<string, unknown> | undefined
      try {
        const clone = response.clone()
        const json = await clone.json()
        newValues = json?.data ?? undefined
      } catch { /* response not JSON or already consumed */ }

      await prisma.auditLog.create({
        data: {
          userId: session.user.id!,
          action,
          entity: entityName,
          entityId,
          newValues: newValues ? (newValues as object) : undefined,
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
          userAgent: req.headers.get('user-agent') ?? undefined,
        },
      })
    } catch { /* audit must never throw */ }

    return response
  }
}
