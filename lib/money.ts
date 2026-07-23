export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function calcLineTotal(params: {
  quantity: number
  unitPrice: number
  discountPct?: number
  taxRate?: number
}): {
  netTotal: number
  discountAmount: number
  taxAmount: number
  grossTotal: number
} {
  const qty = Number(params.quantity) || 0
  const price = Number(params.unitPrice) || 0
  const discountPct = Number(params.discountPct) || 0
  const taxRate = Number(params.taxRate) || 0

  const lineTotal = qty * price
  const discountAmount = round2(lineTotal * discountPct / 100)
  const netTotal = round2(lineTotal - discountAmount)
  const taxAmount = round2(netTotal * taxRate / 100)
  const grossTotal = round2(netTotal + taxAmount)

  return { netTotal, discountAmount, taxAmount, grossTotal }
}

export function calcOrderTotals(lines: Array<{
  netTotal: number
  taxAmount: number
  discountAmount: number
  grossTotal: number
}>): {
  subTotal: number
  totalTax: number
  totalDiscount: number
  grandTotal: number
} {
  let subTotal = 0, totalTax = 0, totalDiscount = 0, grandTotal = 0
  for (const l of lines) {
    subTotal = round2(subTotal + l.netTotal)
    totalTax = round2(totalTax + l.taxAmount)
    totalDiscount = round2(totalDiscount + l.discountAmount)
    grandTotal = round2(grandTotal + l.grossTotal)
  }
  return { subTotal, totalTax, totalDiscount, grandTotal }
}

export function calcDiscountedPrice(price: number, discountPct: number): number {
  return round2(price * (1 - (Number(discountPct) || 0) / 100))
}

export function calcTaxExclusive(inclusiveAmount: number, taxRate: number): number {
  const rate = Number(taxRate) || 0
  if (rate === 0) return round2(inclusiveAmount)
  return round2(inclusiveAmount / (1 + rate / 100))
}

export function calcTaxAmount(netAmount: number, taxRate: number): number {
  return round2(netAmount * (Number(taxRate) || 0) / 100)
}
