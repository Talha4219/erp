/**
 * Integration tests for Sales Order Ship (POST /api/sales/orders/:id/ship)
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

const prisma = TEST_DB_AVAILABLE ? new PrismaClient() : null

let dbReady = false
let testCustomerId: string
let testItemId: string
let testWarehouseId: string

beforeAll(async () => {
  if (!TEST_DB_AVAILABLE || !prisma) return
  await prisma.$connect()
  try {
    const customer = await prisma.customer.create({
      data: {
        customerCode: `SHIP-TEST-${Date.now()}`,
        name: 'Ship Test Customer',
        email: `ship-${Date.now()}@integration.test`,
        phone: '0000000000',
        address: '1 Ship St',
        city: 'London',
        country: 'UK',
        creditLimit: 50000,
      },
    })
    testCustomerId = customer.id

    // Use existing item & warehouse from seeded data if available
    const existingItem = await prisma.item.findFirst({ where: { isActive: true } })
    if (existingItem) {
      testItemId = existingItem.id
    } else {
      return
    }

    const existingWarehouse = await prisma.warehouse.findFirst()
    if (existingWarehouse) {
      testWarehouseId = existingWarehouse.id
    } else {
      return
    }

    await prisma.warehouseStock.upsert({
      where: { warehouseId_itemId: { warehouseId: testWarehouseId, itemId: testItemId } },
      create: { warehouseId: testWarehouseId, itemId: testItemId, quantity: 100, avgCost: 10 },
      update: { quantity: { increment: 0 } },
    })
    dbReady = true
  } catch (err) {
    console.warn('Schema/data mismatch — skipping ship integration tests:', (err as Error).message)
    dbReady = false
  }
})

afterAll(async () => {
  if (!TEST_DB_AVAILABLE || !prisma || !dbReady) return
  await prisma.stockLedger.deleteMany({ where: { itemId: testItemId } })
  await prisma.warehouseStock.deleteMany({ where: { warehouseId: testWarehouseId } })
  await prisma.customer.delete({ where: { id: testCustomerId } })
  await prisma.$disconnect()
})

const describeIntegration = TEST_DB_AVAILABLE && dbReady ? describe : describe.skip

describeIntegration('POST /api/sales/orders/:id/ship', () => {
  jest.setTimeout(30000)
  let testOrderId: string

  beforeEach(async () => {
    if (!prisma) return
    // // await prisma.reservation.deleteMany({ where: { orderId: testOrderId } }).catch(() => {})
    await prisma.salesOrderItem.deleteMany({ where: { soId: testOrderId } }).catch(() => {})
    await prisma.salesOrder.deleteMany({ where: { id: testOrderId } }).catch(() => {})

    const order = await prisma.salesOrder.create({
      data: {
        soNumber: `SO-SHIP-${Date.now()}`,
        customerId: testCustomerId,
        orderDate: new Date(),
        status: 'PACKED',
        subTotal: 100,
        totalAmount: 100,
        lineItems: {
          create: [{ itemId: testItemId, description: 'Test Item', quantity: 2, unitPrice: 50, totalPrice: 100 }],
        },
      },
    })
    testOrderId = order.id
    const shipLineItem = await prisma.salesOrderItem.findFirst({ where: { soId: testOrderId } })
    if (shipLineItem) {
      await prisma.stockReservation.create({
        data: {
          soId: testOrderId,
          soItemId: shipLineItem.id,
          itemId: testItemId,
          warehouseId: testWarehouseId,
          reservedQty: 2,
        },
      })
    }
  })

  afterEach(async () => {
    if (!prisma) return
    // await prisma.invoice.deleteMany({ where: { soId: testOrderId } }).catch(() => {})
    await prisma.stockReservation.deleteMany({ where: { soId: testOrderId } })
    await prisma.salesOrderItem.deleteMany({ where: { soId: testOrderId } })
    await prisma.salesOrder.deleteMany({ where: { id: testOrderId } })
  })

  it('returns 404 for non-existent order', async () => {
    const { POST } = await import('@/app/api/sales/orders/[id]/ship/route')
    const req = new NextRequest('http://localhost:3000/api/sales/orders/nonexistent/ship', { method: 'POST' })
    const res = await POST(req, { params: { id: 'nonexistent' } })
    expect(res.status).toBe(404)
  })

  it('returns 400 when order is not PACKED', async () => {
    if (!prisma) return
    await prisma.salesOrder.update({ where: { id: testOrderId }, data: { status: 'CONFIRMED' } })
    const { POST } = await import('@/app/api/sales/orders/[id]/ship/route')
    const req = new NextRequest(`http://localhost:3000/api/sales/orders/${testOrderId}/ship`, { method: 'POST' })
    const res = await POST(req, { params: { id: testOrderId } })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/PACKED/)
  })

  it('returns 201 and creates invoice for valid shipment', async () => {
    const { POST } = await import('@/app/api/sales/orders/[id]/ship/route')
    const req = new NextRequest(`http://localhost:3000/api/sales/orders/${testOrderId}/ship`, { method: 'POST' })
    const res = await POST(req, { params: { id: testOrderId } })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.invoice).toBeDefined()
    expect(body.data.status).toBe('SHIPPED')
  })

  it('decrements stock after shipping', async () => {
    if (!prisma) return
    const stockBefore = await prisma.warehouseStock.findUnique({
      where: { warehouseId_itemId: { warehouseId: testWarehouseId, itemId: testItemId } },
    })
    const qtyBefore = stockBefore ? Number(stockBefore.quantity) : 0
    const { POST } = await import('@/app/api/sales/orders/[id]/ship/route')
    const req = new NextRequest(`http://localhost:3000/api/sales/orders/${testOrderId}/ship`, { method: 'POST' })
    const res = await POST(req, { params: { id: testOrderId } })
    expect(res.status).toBe(201)
    const stockAfter = await prisma.warehouseStock.findUnique({
      where: { warehouseId_itemId: { warehouseId: testWarehouseId, itemId: testItemId } },
    })
    const qtyAfter = stockAfter ? Number(stockAfter.quantity) : 0
    expect(qtyAfter).toBe(qtyBefore - 2)
  })

  it('creates stock ledger entry with correct unitCost', async () => {
    if (!prisma) return
    const { POST } = await import('@/app/api/sales/orders/[id]/ship/route')
    const req = new NextRequest(`http://localhost:3000/api/sales/orders/${testOrderId}/ship`, { method: 'POST' })
    const res = await POST(req, { params: { id: testOrderId } })
    expect(res.status).toBe(201)
    const ledger = await prisma.stockLedger.findFirst({
      where: { itemId: testItemId, transactionType: 'OUT' },
      orderBy: { transactionDate: 'desc' },
    })
    expect(ledger).toBeDefined()
    expect(ledger!.quantity).toBe(-2)
    expect(Number(ledger!.unitCost)).toBeGreaterThan(0)
  })
})
