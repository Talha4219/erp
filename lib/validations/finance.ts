import { z } from 'zod'

export const accountSchema = z.object({
  code: z.string().min(1, 'Account code is required'),
  name: z.string().min(2, 'Account name is required'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  parentId: z.string().optional(),
  description: z.string().optional(),
})

const journalLineSchema = z.object({
  debitAccountId: z.string().optional(),
  creditAccountId: z.string().optional(),
  description: z.string().optional(),
  debitAmount: z.number().nonnegative().default(0),
  creditAmount: z.number().nonnegative().default(0),
})

export const journalEntrySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required'),
  reference: z.string().optional(),
  lines: z.array(journalLineSchema).min(2, 'At least 2 lines required'),
})

export const costCentreSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(2, 'Name is required'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const currencySchema = z.object({
  code: z.string().length(3, 'Currency code must be 3 characters'),
  name: z.string().min(2, 'Name is required'),
  symbol: z.string().min(1, 'Symbol is required'),
  exchangeRate: z.number().nonnegative().default(1),
  isBase: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export const fixedAssetSchema = z.object({
  assetCode: z.string().optional(),
  name: z.string().min(2, 'Name is required'),
  accountId: z.string().min(1, 'Account is required'),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  purchaseCost: z.number().nonnegative('Cost must be non-negative'),
  residualValue: z.number().nonnegative().default(0),
  usefulLifeYears: z.number().int().positive('Useful life must be positive'),
  depreciationMethod: z.enum(['STRAIGHT_LINE', 'DECLINING_BALANCE']).default('STRAIGHT_LINE'),
  status: z.enum(['ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED', 'TRANSFERRED']).default('ACTIVE'),
  description: z.string().optional(),
  location: z.string().optional(),
})

export const taxRateSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  taxType: z.enum(['VAT', 'GST', 'SALES_TAX', 'WITHHOLDING', 'EXEMPT']).default('VAT'),
  rate: z.number().min(0).max(100, 'Rate must be between 0 and 100'),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
})

export type AccountInput = z.infer<typeof accountSchema>
export type JournalEntryInput = z.infer<typeof journalEntrySchema>
export type CostCentreInput = z.infer<typeof costCentreSchema>
export type CurrencyInput = z.infer<typeof currencySchema>
export type FixedAssetInput = z.infer<typeof fixedAssetSchema>
export type TaxRateInput = z.infer<typeof taxRateSchema>
