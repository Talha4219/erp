jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: { auditLog: { create: jest.fn() } },
}))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { withAudit } from '@/lib/middleware/audit'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

function makeReq(url: string, method = 'GET'): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, { method })
}

function okHandler() {
  return Promise.resolve(NextResponse.json({ success: true, data: { id: 'new-id' } }))
}

describe('withAudit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(auth as jest.Mock).mockResolvedValue({
      user: { id: 'audit-user', name: 'Auditor', email: 'a@t.com', role: 'ADMIN' },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    })
  })

  it('skips audit log for GET requests', async () => {
    const handler = withAudit(okHandler)
    await handler(makeReq('/api/sales/orders', 'GET'), { params: {} })
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('creates audit log for POST requests', async () => {
    const handler = withAudit(okHandler, 'SalesOrder')
    await handler(makeReq('/api/sales/orders', 'POST'), { params: {} })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'CREATE', entity: 'SalesOrder' }),
      })
    )
  })

  it('does NOT create audit log when response is non-2xx', async () => {
    const errorHandler = () =>
      Promise.resolve(NextResponse.json({ success: false }, { status: 404 }))
    const handler = withAudit(errorHandler)
    await handler(makeReq('/api/sales/orders', 'POST'), { params: {} })
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('infers entity from pathname when not provided', async () => {
    const handler = withAudit(okHandler)
    await handler(makeReq('/api/sales/orders', 'POST'), { params: {} })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entity: 'SalesOrders' }),
      })
    )
  })

  it('infers multi-segment entity from pathname', async () => {
    const handler = withAudit(okHandler)
    await handler(makeReq('/api/finance/dashboard', 'POST'), { params: {} })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entity: 'FinanceDashboard' }),
      })
    )
  })

  it('infers action as CREATE for POST', async () => {
    const handler = withAudit(okHandler)
    await handler(makeReq('/api/sales/orders', 'POST'), { params: {} })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'CREATE' }) })
    )
  })

  it('infers action as UPDATE for PUT with id param', async () => {
    const handler = withAudit(okHandler)
    await handler(makeReq('/api/sales/orders/ord-1', 'PUT'), { params: { id: 'ord-1' } })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'UPDATE' }) })
    )
  })

  it('infers action as CREATE for PUT without id param', async () => {
    const handler = withAudit(okHandler)
    await handler(makeReq('/api/sales/orders', 'PUT'), { params: {} })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'CREATE' }) })
    )
  })

  it('infers action as DELETE for DELETE with id param', async () => {
    const handler = withAudit(okHandler)
    await handler(makeReq('/api/sales/orders/ord-1', 'DELETE'), { params: { id: 'ord-1' } })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'DELETE' }) })
    )
  })

  it('passes through the handler response unchanged', async () => {
    const handler = withAudit(okHandler)
    const res = await handler(makeReq('/api/sales/orders', 'GET'), { params: {} })
    const body = await res.json()
    expect(body).toEqual({ success: true, data: { id: 'new-id' } })
  })
})
