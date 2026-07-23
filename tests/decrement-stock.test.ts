jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {},
}))

import { decrementStock } from '@/lib/stock'

function mockTx() {
  return {
    warehouseStock: { updateMany: jest.fn() },
    stockLedger: { create: jest.fn() },
  } as any
}

describe('decrementStock', () => {
  it('decrements stock when sufficient quantity exists', async () => {
    const tx = mockTx()
    tx.warehouseStock.updateMany.mockResolvedValue({ count: 1 })
    await decrementStock(tx, 'item-1', 'wh-1', 5, { unitCost: 10 })
    expect(tx.warehouseStock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { warehouseId: 'wh-1', itemId: 'item-1', quantity: { gte: 5 } },
        data: { quantity: { decrement: 5 } },
      })
    )
  })

  it('throws error when stock is insufficient (count === 0)', async () => {
    const tx = mockTx()
    tx.warehouseStock.updateMany.mockResolvedValue({ count: 0 })
    await expect(decrementStock(tx, 'item-1', 'wh-1', 999, { unitCost: 10 })).rejects.toThrow(
      'Insufficient stock'
    )
  })

  it('creates a stock ledger entry with negative quantity and costs', async () => {
    const tx = mockTx()
    tx.warehouseStock.updateMany.mockResolvedValue({ count: 1 })
    tx.stockLedger.create.mockResolvedValue({})
    await decrementStock(tx, 'item-1', 'wh-1', 3, {
      unitCost: 12.5,
      referenceType: 'SO',
      referenceId: 'so-1',
      notes: 'shipped',
    })
    expect(tx.stockLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemId: 'item-1',
          warehouseId: 'wh-1',
          transactionType: 'OUT',
          quantity: -3,
          unitCost: 12.5,
          totalCost: 37.5,
          referenceType: 'SO',
          referenceId: 'so-1',
          notes: 'shipped',
        }),
      })
    )
  })

  it('passes transactionDate when provided', async () => {
    const tx = mockTx()
    tx.warehouseStock.updateMany.mockResolvedValue({ count: 1 })
    tx.stockLedger.create.mockResolvedValue({})
    const date = new Date('2025-01-15')
    await decrementStock(tx, 'item-1', 'wh-1', 1, {
      unitCost: 10,
      transactionDate: date,
    })
    expect(tx.stockLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ transactionDate: date }),
      })
    )
  })
})
