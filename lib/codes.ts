import { nextDocNumber } from '@/lib/services/numbering'
import type { Prisma } from '@prisma/client'

// All code generators now delegate to nextDocNumber (atomic increment inside a
// Serializable transaction) instead of the old count-then-probe pattern which
// produced duplicate numbers under concurrent load.

// ─── Inventory ────────────────────────────────────────────────────────────────

export const nextItemSku = (tx?: Prisma.TransactionClient) => nextDocNumber('item_sku', null, tx)

// EAN-13 check digit: odd positions ×1, even positions ×3, round up to next 10.
function ean13CheckDigit(digits12: string): string {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3)
  return String((10 - (sum % 10)) % 10)
}

// Internal item barcode: 13 digits in the in-store EAN range (prefix 20x) with a
// valid check digit — numeric-only so it packs tightly as Code 128-C and also
// scans as EAN-13.
export async function nextItemBarcode(tx?: Prisma.TransactionClient): Promise<string> {
  const seq = await nextDocNumber('item_barcode', null, tx)
  const n = parseInt(seq.split('-').pop() ?? '1', 10)
  const body = '200' + String(n).padStart(9, '0')
  return body + ean13CheckDigit(body)
}

export const nextSerialCode = () => nextDocNumber('serial_number')

// ─── Sales ────────────────────────────────────────────────────────────────────

export const nextQuotationNumber = () => nextDocNumber('quotation')

export const nextSalesOrderNumber = () => nextDocNumber('sales_order')

export const nextCustomerInvoiceNumber = () => nextDocNumber('customer_invoice')

export const nextSalesReturnNumber = () => nextDocNumber('sales_return')

export const nextCreditNoteNumber = () => nextDocNumber('credit_note')

export const nextPriceListCode = () => nextDocNumber('price_list')

// ─── Procurement ──────────────────────────────────────────────────────────────

export const nextPurchaseRequestNumber = () => nextDocNumber('purchase_requisition')

export const nextRfqNumber = () => nextDocNumber('rfq')

export const nextSupplierQuotationNumber = () => nextDocNumber('supplier_quotation')

export const nextPurchaseOrderNumber = () => nextDocNumber('purchase_order')

export const nextPurchaseReturnNumber = () => nextDocNumber('purchase_return')

export const nextVendorInvoiceNumber = () => nextDocNumber('vendor_invoice')
