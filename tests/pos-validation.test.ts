jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    storeSettings: { findUnique: jest.fn() },
    item: { findMany: jest.fn() },
    salesOrderV2: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/stripe', () => ({
  getStripe: jest.fn(),
  stripeBreaker: { call: jest.fn() },
}))

jest.mock('@/lib/repositories/sales-repository', () => ({
  salesRepository: { createPosOrder: jest.fn() },
}))

jest.mock('@/lib/events/bus', () => ({
  eventBus: { emit: jest.fn() },
}))

import { processPosSale } from '@/lib/services/unified-sales-service'
import { prisma } from '@/lib/prisma'
import { getStripe, stripeBreaker } from '@/lib/stripe'
import { salesRepository } from '@/lib/repositories/sales-repository'

function makeValidData(overrides: Record<string, unknown> = {}) {
  return {
    customerId: null,
    paymentMethod: 'Cash',
    lineItems: [{ itemId: 'item-1', quantity: 2 }],
    ...overrides,
  }
}

function mockStoreSettings(settings?: unknown) {
  ;(prisma.storeSettings.findUnique as jest.Mock).mockResolvedValue(
    settings ?? { posWarehouseId: 'wh-1' }
  )
}

function mockItems(items?: unknown[]) {
  ;(prisma.item.findMany as jest.Mock).mockResolvedValue(
    items ?? [
      {
        id: 'item-1',
        isActive: true,
        isSellable: true,
        sellingPrice: 15,
        vatRate: 0.2,
        standardCost: 8,
        name: 'Test Item',
      },
    ]
  )
}

function mockTransactionWith(tx: Record<string, any>) {
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: (...args: any[]) => any) => cb(tx))
}

function makeDefaultTx() {
  return {
    warehouseStock: {
      findUnique: jest.fn().mockResolvedValue({ quantity: 100, avgCost: 8 }),
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    stockLedger: { createMany: jest.fn() },
    customer: { update: jest.fn() },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('processPosSale — input validation', () => {
  it('rejects when lineItems is empty', async () => {
    ;(prisma.item.findMany as jest.Mock).mockResolvedValue([])
    mockStoreSettings({ posWarehouseId: 'wh-1' })
    mockTransactionWith(makeDefaultTx())
    await expect(processPosSale(makeValidData({ lineItems: [] }))).rejects.toThrow()
  })

  it('rejects when item not found', async () => {
    ;(prisma.item.findMany as jest.Mock).mockResolvedValue([])
    mockStoreSettings({ posWarehouseId: 'wh-1' })
    await expect(
      processPosSale(makeValidData({ lineItems: [{ itemId: 'nonexistent', quantity: 1 }] }))
    ).rejects.toThrow('not found')
  })

  it('rejects when item is inactive', async () => {
    ;(prisma.item.findMany as jest.Mock).mockResolvedValue([
      { id: 'item-1', isActive: false, isSellable: true, sellingPrice: 10, vatRate: 0, standardCost: 5, name: 'Inactive' },
    ])
    mockStoreSettings({ posWarehouseId: 'wh-1' })
    await expect(
      processPosSale(makeValidData({ lineItems: [{ itemId: 'item-1', quantity: 1 }] }))
    ).rejects.toThrow('not available for sale')
  })
})

describe('processPosSale — price recompute from DB', () => {
  beforeEach(() => {
    mockItems()
    mockStoreSettings()
    mockTransactionWith(makeDefaultTx())
    ;(salesRepository.createPosOrder as jest.Mock).mockResolvedValue({
      id: 'pos-1',
      totalAmount: 36,
      taxAmount: 6,
    })
  })

  it('uses item.sellingPrice from DB to compute unitPriceGbp', async () => {
    await processPosSale(makeValidData())
    const createCall = (salesRepository.createPosOrder as jest.Mock).mock.calls[0]
    expect(createCall[1].computedLines[0].unitPriceGbp).toBe(15)
  })

  it('computes net total from sellingPrice * quantity', async () => {
    await processPosSale(makeValidData())
    const createCall = (salesRepository.createPosOrder as jest.Mock).mock.calls[0]
    expect(createCall[1].totals.netTotalGbp).toBe(30)
  })

  it('computes VAT correctly from item.vatRate', async () => {
    await processPosSale(makeValidData())
    const createCall = (salesRepository.createPosOrder as jest.Mock).mock.calls[0]
    expect(createCall[1].computedLines[0].vatRateApplied).toBe(0.2)
    expect(createCall[1].totals.vatAmountGbp).toBe(6)
  })
})

describe('processPosSale — discount clamping', () => {
  beforeEach(() => {
    mockItems()
    mockStoreSettings()
    mockTransactionWith(makeDefaultTx())
    ;(salesRepository.createPosOrder as jest.Mock).mockResolvedValue({
      id: 'pos-1',
      totalAmount: 15,
      taxAmount: 3,
    })
  })

  it('clamps lineDiscountGbp to gross when discount exceeds gross', async () => {
    await processPosSale(
      makeValidData({ lineItems: [{ itemId: 'item-1', quantity: 1, lineDiscountGbp: 999 }] })
    )
    const createCall = (salesRepository.createPosOrder as jest.Mock).mock.calls[0]
    expect(createCall[1].computedLines[0].lineDiscountGbp).toBe(15)
    expect(createCall[1].totals.totalDiscountGbp).toBe(15)
  })

  it('applies discount below gross without clamping', async () => {
    await processPosSale(
      makeValidData({ lineItems: [{ itemId: 'item-1', quantity: 2, lineDiscountGbp: 5 }] })
    )
    const createCall = (salesRepository.createPosOrder as jest.Mock).mock.calls[0]
    expect(createCall[1].computedLines[0].lineDiscountGbp).toBe(5)
  })

  it('defaults lineDiscountGbp to 0 when not provided', async () => {
    await processPosSale(makeValidData())
    const createCall = (salesRepository.createPosOrder as jest.Mock).mock.calls[0]
    expect(createCall[1].computedLines[0].lineDiscountGbp).toBe(0)
  })
})

describe('processPosSale — insufficient stock', () => {
  it('rejects when warehouseStock.updateMany returns count 0', async () => {
    mockItems()
    mockStoreSettings()
    const tx = makeDefaultTx()
    tx.warehouseStock.updateMany.mockResolvedValue({ count: 0 })
    mockTransactionWith(tx)
    await expect(processPosSale(makeValidData())).rejects.toThrow('Insufficient stock')
  })

  it('rejects when no warehouse has stock and no POS warehouse set', async () => {
    mockItems()
    mockStoreSettings({ posWarehouseId: null })
    const tx = makeDefaultTx()
    tx.warehouseStock.findUnique.mockResolvedValue(null)
    tx.warehouseStock.findFirst.mockResolvedValue(null)
    mockTransactionWith(tx)
    await expect(processPosSale(makeValidData())).rejects.toThrow('No stock location')
  })
})

describe('processPosSale — Stripe cross-check', () => {
  beforeEach(() => {
    mockItems()
    mockStoreSettings()
    mockTransactionWith(makeDefaultTx())
    ;(salesRepository.createPosOrder as jest.Mock).mockResolvedValue({
      id: 'pos-1',
      totalAmount: 36,
      taxAmount: 6,
    })
    ;(stripeBreaker.call as jest.Mock).mockImplementation(async (fn: (...args: any[]) => any) => fn())
  })

  it('rejects when Stripe payment intent has not succeeded', async () => {
    ;(getStripe as jest.Mock).mockReturnValue({
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({ status: 'requires_payment_method' }),
      },
    })
    await expect(
      processPosSale(
        makeValidData({ paymentMethod: 'Card', stripePaymentIntentId: 'pi_123' })
      )
    ).rejects.toThrow('Card payment not completed')
  })

  it('rejects when charged amount does not match grand total', async () => {
    ;(getStripe as jest.Mock).mockReturnValue({
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({ status: 'succeeded', amount_received: 100 }),
      },
    })
    await expect(
      processPosSale(
        makeValidData({ paymentMethod: 'Card', stripePaymentIntentId: 'pi_123' })
      )
    ).rejects.toThrow('Payment amount mismatch')
  })

  it('accepts when charged amount matches grand total within tolerance', async () => {
    ;(getStripe as jest.Mock).mockReturnValue({
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({ status: 'succeeded', amount_received: 3600 }),
      },
    })
    await expect(
      processPosSale(
        makeValidData({ paymentMethod: 'Card', stripePaymentIntentId: 'pi_123' })
      )
    ).resolves.toBeDefined()
  })
})
