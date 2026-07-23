// App-wide currency, set once from Settings → Company Profile and read by every
// formatCurrency/formatGBP call across the app. A plain module singleton (not React
// state) so the ~90 existing call sites don't need to be touched to become currency-aware.

export const CURRENCY_META: Record<string, { symbol: string; locale: string; name: string }> = {
  GBP: { symbol: '£', locale: 'en-GB', name: 'British Pound' },
  USD: { symbol: '$', locale: 'en-US', name: 'US Dollar' },
  EUR: { symbol: '€', locale: 'de-DE', name: 'Euro' },
  INR: { symbol: '₹', locale: 'en-IN', name: 'Indian Rupee' },
  PKR: { symbol: '₨', locale: 'en-PK', name: 'Pakistani Rupee' },
  AED: { symbol: 'د.إ', locale: 'ar-AE', name: 'UAE Dirham' },
  SAR: { symbol: '﷼', locale: 'ar-SA', name: 'Saudi Riyal' },
  AUD: { symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar' },
  CAD: { symbol: 'C$', locale: 'en-CA', name: 'Canadian Dollar' },
  JPY: { symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen' },
  CNY: { symbol: '¥', locale: 'zh-CN', name: 'Chinese Yuan' },
}

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_META)

let currentCode = 'GBP'

export function setAppCurrency(code: string | null | undefined) {
  if (code) currentCode = code.toUpperCase()
}

export function getAppCurrencyCode(): string {
  return currentCode
}

export function getAppCurrencyLocale(): string {
  return CURRENCY_META[currentCode]?.locale ?? 'en-GB'
}

export function getAppCurrencySymbol(): string {
  return CURRENCY_META[currentCode]?.symbol ?? currentCode
}
