import { recalcAvgCost } from '@/lib/stock'
import { round2 } from '@/lib/money'

describe('recalcAvgCost', () => {
  it('computes weighted average correctly for normal mix', () => {
    const result = recalcAvgCost(10, 5, 5, 10)
    const expected = round2((10 * 5 + 5 * 10) / 15)
    expect(result).toBe(expected)
  })

  it('returns incomingUnitCost when current qty + incoming qty <= 0', () => {
    expect(recalcAvgCost(0, 0, 5, 10)).toBe(10)
    expect(recalcAvgCost(5, 5, -5, 10)).toBe(10)
    expect(recalcAvgCost(0, 100, 3, 7.5)).toBe(7.5)
  })

  it('rounds result to 2 decimal places', () => {
    const result = recalcAvgCost(3, 3.33, 2, 5.55)
    expect(result).toBe(4.22)
  })

  it('handles zero incoming qty by returning current avg cost', () => {
    const result = recalcAvgCost(10, 8.5, 0, 0)
    expect(result).toBe(8.5)
  })
})
