/**
 * Tests that route handlers enforce hasModuleAccess properly.
 * We mock auth to return a session with limited allowedModules, then
 * verify that protected routes return 403 for disallowed modules.
 */

import { NextRequest } from 'next/server'

// Mock next-auth/jwt before any imports — it's ESM-only and can't be parsed by ts-jest
jest.mock('next-auth/jwt', () => ({
  decode: jest.fn(),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ getAll: jest.fn().mockReturnValue([]) }),
}))

function mockAuthForModule(allowedModules: string[] | null) {
  jest.mock('@/lib/auth', () => ({
    auth: jest.fn().mockResolvedValue({
      user: { id: 'test-user', name: 'Test', email: 't@t.com', role: 'ADMIN', allowedModules },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    }),
  }))
}

function makeReq(url: string, method = 'GET'): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, { method })
}

describe('route-level permission enforcement', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.restoreAllMocks()
  })

  it('sales routes return 403 when user lacks sales module', async () => {
    mockAuthForModule(['dashboard'])
    const { GET } = await import('@/app/api/sales/orders/route')
    const res = await GET(makeReq('/api/sales/orders'), {})
    expect(res.status).toBe(403)
  })

  it('sales routes return 200 when user has sales module', async () => {
    mockAuthForModule(['sales'])
    const { GET } = await import('@/app/api/sales/orders/route')
    const res = await GET(makeReq('/api/sales/orders'), {})
    expect(res.status).toBe(200)
  })

  it('finance dashboard returns 403 without finance module', async () => {
    mockAuthForModule(['dashboard'])
    const { GET } = await import('@/app/api/finance/dashboard/route')
    const res = await GET(makeReq('/api/finance/dashboard'), { params: {} })
    expect(res.status).toBe(403)
  })

  it('finance dashboard returns 200 with finance module', async () => {
    mockAuthForModule(['finance'])
    const { GET } = await import('@/app/api/finance/dashboard/route')
    const res = await GET(makeReq('/api/finance/dashboard'), { params: {} })
    expect(res.status).toBe(200)
  })

  it('inventory items route returns 403 without inventory module', async () => {
    mockAuthForModule(['sales'])
    const { GET } = await import('@/app/api/inventory/items/route')
    const res = await GET(makeReq('/api/inventory/items'), {})
    expect(res.status).toBe(403)
  })

  it('inventory items route returns 200 with inventory module', async () => {
    mockAuthForModule(['inventory'])
    const { GET } = await import('@/app/api/inventory/items/route')
    const res = await GET(makeReq('/api/inventory/items'), {})
    expect(res.status).toBe(200)
  })

  it('procurement dashboard returns 403 without procurement module', async () => {
    mockAuthForModule(['dashboard'])
    const { GET } = await import('@/app/api/procurement/dashboard/route')
    const res = await GET(makeReq('/api/procurement/dashboard'), { params: {} })
    expect(res.status).toBe(403)
  })

  it('procurement dashboard returns 200 with procurement module', async () => {
    mockAuthForModule(['procurement'])
    const { GET } = await import('@/app/api/procurement/dashboard/route')
    const res = await GET(makeReq('/api/procurement/dashboard'), { params: {} })
    expect(res.status).toBe(200)
  })

  it('hr dashboard returns 403 without hr module', async () => {
    mockAuthForModule(['sales'])
    const { GET } = await import('@/app/api/hr/dashboard/route')
    const res = await GET(makeReq('/api/hr/dashboard'), { params: {} })
    expect(res.status).toBe(403)
  })

  it('hr dashboard returns 200 with hr module', async () => {
    mockAuthForModule(['hr'])
    const { GET } = await import('@/app/api/hr/dashboard/route')
    const res = await GET(makeReq('/api/hr/dashboard'), { params: {} })
    expect(res.status).toBe(200)
  })

  it('crm routes return 403 without crm module', async () => {
    mockAuthForModule(['sales'])
    const { GET } = await import('@/app/api/crm/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('crm routes return 200 with crm module', async () => {
    mockAuthForModule(['crm'])
    const { GET } = await import('@/app/api/crm/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('pos POST returns 403 without pos module', async () => {
    mockAuthForModule(['dashboard'])
    const { POST } = await import('@/app/api/retail/pos/route')
    const body = makeReq('/api/retail/pos', 'POST')
    const res = await POST(body, {})
    expect(res.status).toBe(403)
  })

  it('pos POST returns 500 with pos module (handler fails, not auth)', async () => {
    // A 500 means auth+module passed but the handler errored (expected with no DB mock)
    mockAuthForModule(['pos'])
    const { POST } = await import('@/app/api/retail/pos/route')
    const req = new NextRequest('http://localhost:3000/api/retail/pos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineItems: [{ itemId: 'x', quantity: 1 }], paymentMethod: 'Cash' }),
    })
    const res = await POST(req, {})
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(401)
  })

  describe('role hierarchy enforcement', () => {
    it('returns 401 for unauthenticated access to protected route', async () => {
      jest.resetModules()
      jest.restoreAllMocks()
      // Override auth mock to return null
      jest.doMock('@/lib/auth', () => ({
        auth: jest.fn().mockResolvedValue(null),
      }))
      const { GET } = await import('@/app/api/sales/orders/route')
      const res = await GET(makeReq('/api/sales/orders'), {})
      expect(res.status).toBe(401)
    })

    it('returns 403 for VIEWER accessing sales routes', async () => {
      jest.resetModules()
      jest.restoreAllMocks()
      jest.doMock('@/lib/auth', () => ({
        auth: jest.fn().mockResolvedValue({
          user: { id: 'viewer-user', name: 'Viewer', email: 'v@t.com', role: 'VIEWER', allowedModules: null },
          expires: new Date(Date.now() + 3600_000).toISOString(),
        }),
      }))
      const { GET } = await import('@/app/api/sales/orders/route')
      const res = await GET(makeReq('/api/sales/orders'), {})
      expect(res.status).toBe(403)
    })

    it('returns 200 for ADMIN accessing sales routes', async () => {
      jest.resetModules()
      jest.restoreAllMocks()
      jest.doMock('@/lib/auth', () => ({
        auth: jest.fn().mockResolvedValue({
          user: { id: 'admin-user', name: 'Admin', email: 'a@t.com', role: 'ADMIN', allowedModules: null },
          expires: new Date(Date.now() + 3600_000).toISOString(),
        }),
      }))
      const { GET } = await import('@/app/api/sales/orders/route')
      const res = await GET(makeReq('/api/sales/orders'), {})
      expect(res.status).toBe(200)
    })
  })
})
