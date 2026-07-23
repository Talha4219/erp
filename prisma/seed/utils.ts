export const PASSWORD_HASH = '$2b$10$Qc9Mo7MPH5lJOBENrJUHyeGb.XUUIJNTxqk/0Ib5j5SlLCUXO.u2y'

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

export function randDate(from: Date, to: Date): Date {
  const d = new Date(from.getTime() + Math.random() * (to.getTime() - from.getTime()))
  return d
}

export async function promiseBatch<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(fn))
  }
}

export function generateSKU(categoryCode: string, index: number): string {
  const num = String(index).padStart(4, '0')
  return `${categoryCode}-${num}`
}

export function generateVendorCode(index: number): string {
  return `VEN-${String(index).padStart(4, '0')}`
}

export function generateCustomerCode(index: number): string {
  return `CUST-${String(index).padStart(4, '0')}`
}

export function generatePONumber(index: number): string {
  return `PO-${String(index).padStart(6, '0')}`
}

export function generateSONumber(index: number): string {
  return `SO-${String(index).padStart(6, '0')}`
}

export function generateInvoiceNumber(index: number): string {
  return `INV-${String(index).padStart(6, '0')}`
}

export function generateGRNNumber(index: number): string {
  return `GRN-${String(index).padStart(6, '0')}`
}

export function generateProductSKU(category: string, index: number): string {
  return `${category.slice(0, 3).toUpperCase()}-${String(index).padStart(4, '0')}`
}

export function generateEmployeeCode(index: number): string {
  return `EMP-${String(index).padStart(4, '0')}`
}

export const SALES_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'] as const
export const PO_STATUSES = ['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED'] as const
export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'JazzCash', 'Easypaisa'] as const
