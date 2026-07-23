import { z } from 'zod'

// ── Supplier ──────────────────────────────────────────────────────────────────
export const supplierSchema = z.object({
  companyName: z.string().min(1).max(100),
  contactPerson: z.string().max(100).optional(),
  email: z.string().email().max(100).optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  paymentTerms: z.string().max(50).optional(),
  bankSortCode: z.string().max(10).optional(),
  bankAccountNumber: z.string().max(20).optional(),
  leadTimeDays: z.number().int().nonnegative().default(7),
  performanceRating: z.number().int().min(1).max(5).default(3),
  isActive: z.boolean().default(true),
})
export type SupplierInput = z.infer<typeof supplierSchema>

// ── Product ───────────────────────────────────────────────────────────────────
export const productSchema = z.object({
  sku: z.string().min(1).max(50),
  productName: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  sellingPriceGbp: z.number().nonnegative(),
  vatRate: z.number().min(0).max(100).default(20),
  reorderLevel: z.number().int().nonnegative().default(10),
  locationAisle: z.string().max(50).optional(),
})
export type ProductInput = z.infer<typeof productSchema>

// ── RetailCustomer (backward-compat alias; uses Customer now) ─────────────────
export const retailCustomerSchema = z.object({
  title: z.string().max(10).optional(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email().max(100),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  marketingOptIn: z.boolean().default(false),
  gdprConsentDate: z.string().optional(),
  dataRetentionConsent: z.boolean().default(false),
})
export type RetailCustomerInput = z.infer<typeof retailCustomerSchema>

// ── Customer addresses ────────────────────────────────────────────────────────
export const customerAddressSchema = z.object({
  customerId: z.string().min(1),
  addressLine1: z.string().min(1),
  city: z.string().min(1),
  postcode: z.string().min(1).max(10),
  isPrimary: z.boolean().default(false),
})
export type CustomerAddressInput = z.infer<typeof customerAddressSchema>

// ── InventoryBatch ────────────────────────────────────────────────────────────
export const inventoryBatchSchema = z.object({
  itemId: z.string().min(1),
  batchNumber: z.string().min(1),
  manufacturingDate: z.string().optional(),
  expiryDate: z.string().optional(),
  quantityOnHand: z.number().int().nonnegative(),
  receivedDate: z.string().optional(),
  vendorId: z.string().optional(),
})
export type InventoryBatchInput = z.infer<typeof inventoryBatchSchema>

// ── Purchase Order (still uses retail tables pending full migration) ──────────
export const retailPoSchema = z.object({
  supplierId: z.number().int().positive(),
  expectedDeliveryDate: z.string().optional(),
  status: z.enum(['Draft', 'Sent', 'Partially Received', 'Received']).default('Draft'),
  lineItems: z.array(z.object({
    productId: z.number().int().positive(),
    quantityOrdered: z.number().int().positive(),
    unitCostGbp: z.number().nonnegative(),
  })).min(1),
})
export type RetailPoInput = z.infer<typeof retailPoSchema>

export const grnSchema = z.object({
  poId: z.number().int().positive(),
  receivedBy: z.string().min(1),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    lineItemId: z.number().int().positive(),
    quantityReceived: z.number().int().nonnegative(),
  })),
})
export type GrnInput = z.infer<typeof grnSchema>

// ── StockAdjustment ───────────────────────────────────────────────────────────
export const storeSettingsSchema = z.object({
  storeName: z.string().optional(),
  storeCode: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  currency: z.string().default('GBP'),
  taxLabel: z.string().default('VAT'),
  taxRate: z.number().min(0).max(100).default(20),
  receiptFooter: z.string().optional(),
  printerEnabled: z.boolean().default(false),
  printerIp: z.string().optional(),
  posAutoComplete: z.boolean().default(true),
})

export const stockAdjustmentRetailSchema = z.object({
  batchId: z.number().int().positive(),
  quantityChange: z.number().int(),
  reason: z.enum(['Expired', 'Damaged', 'Stock Count', 'Theft', 'Found']),
  adjustedBy: z.string().optional(),
})
export type StockAdjustmentRetailInput = z.infer<typeof stockAdjustmentRetailSchema>

// ── POS order (sells inventory Items directly) ────────────────────────────────
// Prices, VAT and totals are NOT accepted from the client — the server derives
// them from the Item record so a crafted request can't record a £0 sale.
export const posOrderSchema = z.object({
  customerId: z.string().optional(),
  paymentMethod: z.enum(['Cash', 'Card', 'Contactless']),
  stripePaymentIntentId: z.string().optional(),
  lineItems: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.number().int().positive(),
    lineDiscountGbp: z.number().nonnegative().default(0),
  })).min(1),
})
export type PosOrderInput = z.infer<typeof posOrderSchema>

// refundAmountGbp is derived server-side from the original line; the client
// only supplies which line, how many units, and why.
export const returnRefundSchema = z.object({
  originalOrderId: z.string().min(1),
  originalLineId: z.string().min(1),
  quantityReturned: z.number().int().positive(),
  reason: z.string().min(1),
})
export type ReturnRefundInput = z.infer<typeof returnRefundSchema>

// ── Expense ───────────────────────────────────────────────────────────────────
export const expenseSchema = z.object({
  expenseDate: z.string().min(1),
  categoryId: z.number().int().positive(),
  vendorId: z.string().optional(),
  description: z.string().min(1),
  amountGbp: z.number().nonnegative(),
  vatClaimedGbp: z.number().nonnegative().default(0),
  paymentDueDate: z.string().optional(),
  status: z.enum(['Paid', 'Unpaid']).default('Unpaid'),
})
export type ExpenseInput = z.infer<typeof expenseSchema>

export const expenseCategorySchema = z.object({
  categoryName: z.string().min(1),
})
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>

// ── ShiftRoster ───────────────────────────────────────────────────────────────
export const shiftRosterSchema = z.object({
  employeeId: z.string().min(1),
  shiftDate: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
})
export type ShiftRosterInput = z.infer<typeof shiftRosterSchema>

export const shiftAttendanceSchema = z.object({
  shiftId: z.number().int().positive(),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
})
export type ShiftAttendanceInput = z.infer<typeof shiftAttendanceSchema>
