import { NextRequest } from 'next/server'
import { prisma } from './prisma'
import crypto from 'crypto'

export interface PortalContext {
  portalUserId: string
  entityId: string
  type: 'CUSTOMER' | 'SUPPLIER'
  name: string
  email: string
}

/** Generate a secure random portal session token */
export function generatePortalToken(): string {
  return crypto.randomBytes(48).toString('hex')
}

/** Validate an Authorization: Bearer <token> header and return the portal context */
export async function validatePortalToken(req: NextRequest): Promise<PortalContext | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const token = auth.slice(7)
  const session = await prisma.portalSession.findUnique({
    where: { token },
    include: { portalUser: true },
  })

  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt < new Date()) return null
  if (!session.portalUser.isActive || session.portalUser.deletedAt) return null

  return {
    portalUserId: session.portalUser.id,
    entityId: session.portalUser.entityId,
    type: session.portalUser.type as 'CUSTOMER' | 'SUPPLIER',
    name: session.portalUser.name,
    email: session.portalUser.email,
  }
}

/** Revoke all active sessions for a portal user */
export async function revokePortalSessions(portalUserId: string) {
  await prisma.portalSession.updateMany({
    where: { portalUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}
