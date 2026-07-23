import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generatePortalToken } from '@/lib/portal-auth'

const SESSION_DURATION_HOURS = 8

export async function portalLogin(email: string, password: string, ipAddress?: string, userAgent?: string) {
  const portalUser = await prisma.portalUser.findUnique({ where: { email } })
  if (!portalUser || !portalUser.isActive || portalUser.deletedAt) return { error: 'Invalid credentials' }

  if (portalUser.lockedUntil && portalUser.lockedUntil > new Date()) return { error: 'Account temporarily locked. Try again later.' }

  const valid = await bcrypt.compare(password, portalUser.password)
  if (!valid) {
    const newAttempts = portalUser.loginAttempts + 1
    const shouldLock = newAttempts >= 5
    await prisma.portalUser.update({
      where: { id: portalUser.id },
      data: { loginAttempts: newAttempts, lockedUntil: shouldLock ? new Date(Date.now() + 15 * 60_000) : undefined },
    })
    return { error: 'Invalid credentials' }
  }

  const token = generatePortalToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 3600_000)

  await prisma.$transaction([
    prisma.portalSession.create({ data: { portalUserId: portalUser.id, token, expiresAt, ipAddress: ipAddress ?? undefined, userAgent: userAgent ?? undefined } }),
    prisma.portalUser.update({ where: { id: portalUser.id }, data: { lastLoginAt: new Date(), loginAttempts: 0, lockedUntil: null } }),
  ])

  return {
    data: { token, expiresAt, user: { id: portalUser.id, name: portalUser.name, email: portalUser.email, type: portalUser.type, entityId: portalUser.entityId } },
  }
}

export async function portalLogout(token: string) {
  await prisma.portalSession.updateMany({ where: { token }, data: { revokedAt: new Date() } })
}

export function listPortalUsers() {
  return prisma.portalUser.findMany({
    where: { deletedAt: null },
    select: { id: true, email: true, name: true, type: true, entityId: true, phone: true, isActive: true, lastLoginAt: true, createdAt: true, _count: { select: { sessions: true } } },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })
}

export async function createPortalUser(data: { email: string; name: string; password: string; type: string; entityId: string; phone?: string }) {
  const hashedPwd = await bcrypt.hash(data.password, 12)
  return prisma.portalUser.create({
    data: { email: data.email, name: data.name, password: hashedPwd, type: data.type as any, entityId: data.entityId, phone: data.phone },
    select: { id: true, email: true, name: true, type: true, entityId: true, isActive: true, createdAt: true },
  })
}

export async function updatePortalUser(id: string, data: Record<string, unknown>) {
  const updatable = ['name', 'email', 'phone']
  const updateData: Record<string, unknown> = {}
  for (const key of updatable) {
    if (data[key] !== undefined) updateData[key] = data[key]
  }
  if (data.password) updateData.password = await bcrypt.hash(data.password as string, 12)
  return prisma.portalUser.update({ where: { id }, data: updateData as any, select: { id: true, email: true, name: true, type: true, isActive: true } })
}

export async function suspendPortalUser(id: string) {
  const { revokePortalSessions } = await import('@/lib/portal-auth')
  await revokePortalSessions(id)
  await prisma.portalUser.update({ where: { id }, data: { isActive: false } })
}

export async function reactivatePortalUser(id: string) {
  await prisma.portalUser.update({ where: { id }, data: { isActive: true, loginAttempts: 0, lockedUntil: null } })
}

export async function softDeletePortalUser(id: string) {
  const { revokePortalSessions } = await import('@/lib/portal-auth')
  await revokePortalSessions(id)
  await prisma.portalUser.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
}

export function getCustomerOrders(customerId: string) {
  return prisma.salesOrder.findMany({
    where: { customerId, deletedAt: null },
    include: { lineItems: true, _count: { select: { lineItems: true } } },
    orderBy: { orderDate: 'desc' },
    take: 100,
  })
}

export function getCustomerInvoices(customerId: string) {
  return prisma.customerInvoice.findMany({
    where: { customerId, deletedAt: null },
    include: { lineItems: true },
    orderBy: { dueDate: 'asc' },
  })
}

export function getSupplierOrders(vendorId: string) {
  return prisma.purchaseOrder.findMany({
    where: { vendorId, deletedAt: null },
    include: { lineItems: true },
    orderBy: { orderDate: 'desc' },
    take: 100,
  })
}

export function getSupplierRfqs(vendorId: string) {
  return prisma.rfq.findMany({
    where: { vendorId },
    include: { lineItems: true },
    orderBy: { createdAt: 'desc' },
  })
}
