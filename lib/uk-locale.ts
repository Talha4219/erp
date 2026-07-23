// UK locale formatters and FEFO batch selector

import { getAppCurrencyCode, getAppCurrencyLocale } from './currency-store'

// Name kept for the ~90 existing call sites; formats using the ERP's configured
// currency (Settings → Company Profile), not always GBP despite the name.
export function formatGBP(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0)
  return new Intl.NumberFormat(getAppCurrencyLocale(), { style: 'currency', currency: getAppCurrencyCode() }).format(num)
}

export function formatUKDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB')
}

export function formatUKDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-GB', { timeZone: 'Europe/London' })
}

type BatchForFefo = {
  id: number
  quantityOnHand: number
  expiryDate: Date | string | null
  receivedDate: Date | string
}

/** Returns the FEFO-selected batch id (earliest expiry with stock, fallback to earliest received). */
export function selectFefoBatch(batches: BatchForFefo[]): BatchForFefo | null {
  const available = batches.filter((b) => b.quantityOnHand > 0)
  if (available.length === 0) return null

  const withExpiry = available.filter((b) => b.expiryDate != null)
  if (withExpiry.length > 0) {
    return withExpiry.sort((a, b) => {
      const dateA = new Date(a.expiryDate as string | Date).getTime()
      const dateB = new Date(b.expiryDate as string | Date).getTime()
      return dateA - dateB
    })[0]
  }

  return available.sort((a, b) => {
    const dateA = new Date(a.receivedDate).getTime()
    const dateB = new Date(b.receivedDate).getTime()
    return dateA - dateB
  })[0]
}

export function daysUntilExpiry(expiryDate: Date | string | null): number | null {
  if (!expiryDate) return null
  const expiry = new Date(expiryDate)
  const now = new Date()
  const diff = expiry.getTime() - now.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function vatAmount(netPrice: number, vatRate: number): number {
  return Math.round(netPrice * vatRate * 100) / 100
}
