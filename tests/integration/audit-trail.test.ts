/**
 * Integration tests for Audit Trail creation on mutation routes.
 *
 * Verifies that POST to an audited route creates an AuditLog row,
 * GET does not, and failed mutations (400) do not.
 *
 * Requires DATABASE_URL to point to a test database.
 * All tests are skipped when DATABASE_URL is not set.
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

const prisma = TEST_DB_AVAILABLE ? new PrismaClient() : null

let testCustomerId: string

beforeAll(async () => {
  if (!TEST_DB_AVAILABLE || !prisma) return
  await prisma.$connect()

  const customer = await prisma.customer.create({
    data: {
      customerCode: `AUDIT-TEST-${Date.now()}`,
      name: 'Audit Trail Test',
      email: `audit-${Date.now()}@integration.test`,
      phone: '0000000000',
      address: '1 Audit St',
      city: 'London',
      country: 'UK',
      creditLimit: 50000,
    },
  })
  testCustomerId = customer.id
})

afterAll(async () => {
  if (!TEST_DB_AVAILABLE || !prisma) return
  await prisma.auditLog.deleteMany({ where: { userId: 'test-user-id' } })
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

const describeIntegration = TEST_DB_AVAILABLE ? describe : describe.skip

describeIntegration('audit log creation on /api/sales/orders', () => {
  beforeEach(async () => {
    if (!prisma) return
    await prisma.auditLog.deleteMany({ where: { userId: 'test-user-id' } })
  })

  it('does NOT create audit log for GET request', async () => {
    const { GET } = await import('@/app/api/sales/orders/route')
    const res = await GET(makeReq('GET'), {})
    expect(res.status).toBe(200)

    if (!prisma) return
    const logs = await prisma.auditLog.findMany({ where: { userId: 'test-user-id' } })
    expect(logs.length).toBe(0)
  })

  it('creates audit log for successful POST request', async () => {
    const item = await prisma!.item.findFirst({ where: { isActive: true } })
    if (!item) return

    const { POST } = await import('@/app/api/sales/orders/route')
    const req = makeReq('POST', {
      customerId: testCustomerId,
      orderDate: new Date().toISOString().split('T')[0],
      lineItems: [
        { itemId: item.id, description: item.name, quantity: 1, unitPrice: 50, discount: 0, taxRate: 20 },
      ],
    })
    const res = await POST(req, {})
    expect(res.status).toBe(201)

    if (!prisma) return
    const logs = await prisma.auditLog.findMany({
      where: { userId: 'test-user-id', action: 'CREATE', entity: 'SalesOrder' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })
    expect(logs.length).toBe(1)
  })

  it('does NOT create audit log when POST returns 400', async () => {
    const { POST } = await import('@/app/api/sales/orders/route')
    const req = makeReq('POST', { customerId: '' })
    const res = await POST(req, {})
    expect(res.status).toBe(400)

    if (!prisma) return
    const logs = await prisma.auditLog.findMany({ where: { userId: 'test-user-id' } })
    expect(logs.length).toBe(0)
  })
})
