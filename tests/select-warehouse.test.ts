jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {},
}))

import { selectWarehouse } from '@/lib/stock'

function mockTx() {
  return {
    warehouseStock: { findUnique: jest.fn(), findFirst: jest.fn() },
  } as any
}

describe('selectWarehouse', () => {
  it('returns preferred warehouse when stock exists there', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue({ warehouseId: 'wh-1', quantity: 100, avgCost: 10 })
    const result = await selectWarehouse(tx, 'item-1', 'wh-1')
    expect(result).toEqual({ warehouseId: 'wh-1', avgCost: 10 })
    expect(tx.warehouseStock.findFirst).not.toHaveBeenCalled()
  })

  it('falls back to most-stocked warehouse when preferred has no stock', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue(null)
    tx.warehouseStock.findFirst.mockResolvedValue({ warehouseId: 'wh-2', quantity: 50, avgCost: 8 })
    const result = await selectWarehouse(tx, 'item-1', 'wh-1')
    expect(result).toEqual({ warehouseId: 'wh-2', avgCost: 8 })
  })

  it('returns null when no stock exists in any warehouse', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue(null)
    tx.warehouseStock.findFirst.mockResolvedValue(null)
    const result = await selectWarehouse(tx, 'item-1', 'wh-1')
    expect(result).toBeNull()
  })

  it('returns most-stocked warehouse when no preferred given', async () => {
    const tx = mockTx()
    tx.warehouseStock.findFirst.mockResolvedValue({ warehouseId: 'wh-3', quantity: 200, avgCost: 12 })
    const result = await selectWarehouse(tx, 'item-1')
    expect(result).toEqual({ warehouseId: 'wh-3', avgCost: 12 })
  })
})
