import { getStockUnitCost } from '@/lib/stock'

function mockTx() {
  return {
    warehouseStock: { findUnique: jest.fn() },
    stockLedger: { findFirst: jest.fn() },
  } as any
}

describe('getStockUnitCost', () => {
  it('returns avgCost from warehouseStock when found', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue({ avgCost: 15.5 })
    const result = await getStockUnitCost(tx, 'item-1', 'wh-1')
    expect(result).toBe(15.5)
    expect(tx.stockLedger.findFirst).not.toHaveBeenCalled()
  })

  it('falls back to same-warehouse stockLedger when warehouseStock missing', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue(null)
    tx.stockLedger.findFirst.mockResolvedValueOnce({ unitCost: 12 })
    const result = await getStockUnitCost(tx, 'item-1', 'wh-1')
    expect(result).toBe(12)
    expect(tx.stockLedger.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ warehouseId: 'wh-1', unitCost: { gt: 0 } }),
      })
    )
  })

  it('falls back to any-warehouse stockLedger when same-warehouse missing', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue(null)
    tx.stockLedger.findFirst.mockResolvedValueOnce(null)
    tx.stockLedger.findFirst.mockResolvedValueOnce({ unitCost: 10 })
    const result = await getStockUnitCost(tx, 'item-1', 'wh-1')
    expect(result).toBe(10)
  })

  it('returns 0 when no records found anywhere', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue(null)
    tx.stockLedger.findFirst.mockResolvedValue(null)
    const result = await getStockUnitCost(tx, 'item-1', 'wh-1')
    expect(result).toBe(0)
  })

  it('only queries stockLedger rows with unitCost > 0', async () => {
    const tx = mockTx()
    tx.warehouseStock.findUnique.mockResolvedValue(null)
    tx.stockLedger.findFirst.mockResolvedValueOnce(null)
    await getStockUnitCost(tx, 'item-1', 'wh-1')
    expect(tx.stockLedger.findFirst).toHaveBeenCalledTimes(2)
    for (const call of tx.stockLedger.findFirst.mock.calls) {
      expect(call[0].where.unitCost).toEqual({ gt: 0 })
    }
  })
})
