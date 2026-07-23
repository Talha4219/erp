jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {},
}))

import { incrementStock } from '@/lib/stock'

function mockTx() {
  return {
    warehouseStock: { findUnique: jest.fn(), upsert: jest.fn() },
    stockLedger: { create: jest.fn() },
  } as any
}

describe('incrementStock', () => {
  it('creates a new warehouseStock record when none exists', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue(null)
    tx.warehouseStock.upsert.mockResolvedValue({})
    tx.stockLedger.create.mockResolvedValue({})
    await incrementStock(tx, 'item-1', 'wh-1', 10, 5)
    expect(tx.warehouseStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { warehouseId_itemId: { warehouseId: 'wh-1', itemId: 'item-1' } },
        create: { warehouseId: 'wh-1', itemId: 'item-1', quantity: 10, avgCost: 5 },
        update: expect.objectContaining({ quantity: { increment: 10 }, avgCost: 5 }),
      })
    )
  })

  it('updates existing warehouseStock with recalculated avgCost', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue({ quantity: 10, avgCost: 5 })
    tx.warehouseStock.upsert.mockResolvedValue({})
    tx.stockLedger.create.mockResolvedValue({})
    await incrementStock(tx, 'item-1', 'wh-1', 5, 10)
    const newAvg = Math.round(((10 * 5 + 5 * 10) / 15 + Number.EPSILON) * 100) / 100
    expect(tx.warehouseStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ avgCost: newAvg }),
      })
    )
  })

  it('creates a stock ledger entry for the inbound movement', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue(null)
    tx.warehouseStock.upsert.mockResolvedValue({})
    tx.stockLedger.create.mockResolvedValue({})
    await incrementStock(tx, 'item-1', 'wh-1', 5, 7.5, {
      referenceType: 'GRN',
      referenceId: 'grn-1',
      notes: 'received',
    })
    expect(tx.stockLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemId: 'item-1',
          warehouseId: 'wh-1',
          transactionType: 'IN',
          quantity: 5,
          unitCost: 7.5,
          totalCost: 37.5,
          referenceType: 'GRN',
          referenceId: 'grn-1',
          notes: 'received',
        }),
      })
    )
  })

  it('handles zero quantity gracefully', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue({ quantity: 10, avgCost: 5 })
    tx.warehouseStock.upsert.mockResolvedValue({})
    tx.stockLedger.create.mockResolvedValue({})
    await expect(incrementStock(tx, 'item-1', 'wh-1', 0, 5)).resolves.not.toThrow()
  })
})
