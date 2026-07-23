/**
 * Integration tests for Sales Orders API
 * Tests: GET /api/sales/orders, POST /api/sales/orders
 */

import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Must mock auth before importing route handlers
jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: 'test-user-id', name: 'Test', email: 'test@erp.test', role: 'ADMIN' },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  }),
}))

// Use test DB (set via DATABASE_URL env in CI)
const prisma = new PrismaClient()

let testCustomerId: string

beforeAll(async () => {
  // Create a test customer
  const customer = await prisma.customer.create({
    data: {
      customerCode: `CUST-TEST-${Date.now()}`,
      name: 'Test Customer Integration',
      email: `test-so-${Date.now()}@integration.test`,
      phone: '0000000000',
      address: '1 Test St',
      city: 'London',
      country: 'UK',
      creditLimit: 50000,
    },
  })
  testCustomerId = customer.id
})

afterAll(async () => {
  // Cleanup
  await prisma.salesOrderItem.deleteMany({ where: { so: { customerId: testCustomerId } } })
  await prisma.salesOrder.deleteMany({ where: { customerId: testCustomerId } })
  await prisma.customer.delete({ where: { id: testCustomerId } })
  await prisma.$disconnect()
})

function makeReq(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/sales/orders', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/sales/orders', () => {
  it('returns 200 with orders array', async () => {
    const { GET } = await import('@/app/api/sales/orders/route')
    const res = await GET(makeReq('GET'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })
})

describe('POST /api/sales/orders', () => {
  it('returns 400 when body is invalid', async () => {
    const { POST } = await import('@/app/api/sales/orders/route')
    const req = makeReq('POST', { customerId: '' })
    const res = await POST(req, {})
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('creates a sales order and returns 201', async () => {
    const { POST } = await import('@/app/api/sales/orders/route')

    // Look up a real item to use
    const item = await prisma.item.findFirst({ where: { isActive: true } })
    if (!item) {
      console.warn('No active item found — skipping create test')
      return
    }

    const req = makeReq('POST', {
      customerId: testCustomerId,
      orderDate: new Date().toISOString().split('T')[0],
      lineItems: [
        {
          itemId: item.id,
          description: item.name,
          quantity: 2,
          unitPrice: 100,
          discount: 0,
          taxRate: 20,
        },
      ],
    })

    const res = await POST(req, {})
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.soNumber).toMatch(/^SO-/)
    expect(body.data.customerId).toBe(testCustomerId)
  })

  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/lib/auth')
    ;(auth as jest.Mock).mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/sales/orders/route')
    const req = makeReq('POST', {})
    const res = await POST(req, {})
    expect(res.status).toBe(401)
  })
})
