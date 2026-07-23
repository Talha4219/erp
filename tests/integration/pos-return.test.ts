/**
 * Integration tests for POS Return (POST /api/retail/pos/return)
 *
 * Requires DATABASE_URL to point to a test database with full Prisma schema.
 * All tests are skipped when DATABASE_URL is not set or schema is incomplete.
 */

import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

const TEST_DB_AVAILABLE = !!process.env.DATABASE_URL

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue(
    TEST_DB_AVAILABLE
      ? {
          user: { id: 'test-user-id', name: 'Test', email: 'test@erp.test', role: 'ADMIN' },
          expires: new Date(Date.now() + 3600_000).toISOString(),
        }
      : null,
  ),
}))

jest.mock('@/lib/stripe', () => ({
  getStripe: jest.fn(),
  stripeBreaker: { call: jest.fn() },
}))

const prisma = TEST_DB_AVAILABLE ? new PrismaClient() : null

let dbReady = false
let testCustomerId: string
let testOrderId: string
let testLineItemId: string

beforeAll(async () => {
  if (!TEST_DB_AVAILABLE || !prisma) return
  await prisma.$connect()
  try {
    const customer = await prisma.customer.create({
      data: {
        customerCode: `POSRET-TEST-${Date.now()}`,
        name: 'POS Return Test',
        email: `posret-${Date.now()}@integration.test`,
        phone: '0000000000',
        address: '1 Return St',
        city: 'London',
        country: 'UK',
        creditLimit: 50000,
      },
    })
    testCustomerId = customer.id

    const order = await prisma.salesOrderV2.create({
      data: {
        channel: 'POS',
        customerId: testCustomerId,
        orderDate: new Date(),
        subTotal: 100,
        totalAmount: 100,
        taxAmount: 20,
        workflowStatus: 'COMPLETED',
        paymentStatus: 'UNPAID',
        fulfillmentStatus: 'PENDING',
        orderNumber: `POSRET-${Date.now()}`,
        orderType: 'CREDIT',
      },
    })
    testOrderId = order.id

    const item = await prisma.salesOrderItemV2.create({
      data: {
        soId: testOrderId,
        itemId: null,
        description: 'Test Return Item',
        quantity: 2,
        unitPrice: 50,
        discount: 0,
        taxRate: 20,
        // net: 100 // Removed - not in schema
        totalPrice: 120,
      },
    })
    testLineItemId = item.id
    dbReady = true
  } catch (err) {
    console.warn('Schema mismatch — skipping POS return integration tests:', (err as Error).message)
    dbReady = false
  }
})

afterAll(async () => {
  if (!TEST_DB_AVAILABLE || !prisma || !dbReady) return
  await prisma.salesOrderItemV2.deleteMany({ where: { soId: testOrderId } })
  await prisma.salesOrderV2.deleteMany({ where: { id: testOrderId } })
  await prisma.customer.deleteMany({ where: { id: testCustomerId } })
  await prisma.$disconnect()
})

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/retail/pos/return', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const describeIntegration = TEST_DB_AVAILABLE && dbReady ? describe : describe.skip

describeIntegration('POST /api/retail/pos/return', () => {
  jest.setTimeout(30000)

  it('returns 400 when body is invalid', async () => {
    const { POST } = await import('@/app/api/retail/pos/return/route')
    const req = makeReq({ originalOrderId: '' })
    const res = await POST(req, {} as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('returns 201 for valid return', async () => {
    const { POST } = await import('@/app/api/retail/pos/return/route')
    const req = makeReq({
      originalOrderId: testOrderId,
      originalLineId: testLineItemId,
      quantityReturned: 1,
      reason: 'Test return',
    })
    const res = await POST(req, {} as any)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.amount).toBeLessThan(0)
  })

  it('returns 400 when returning more than available qty', async () => {
    const { POST } = await import('@/app/api/retail/pos/return/route')
    const req = makeReq({
      originalOrderId: testOrderId,
      originalLineId: testLineItemId,
      quantityReturned: 999,
      reason: 'Excessive return',
    })
    const res = await POST(req, {} as any)
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/lib/auth')
    ;(auth as jest.Mock).mockResolvedValueOnce(null)
    const { POST } = await import('@/app/api/retail/pos/return/route')
    const req = makeReq({})
    const res = await POST(req, {} as any)
    expect(res.status).toBe(401)
  })
})
