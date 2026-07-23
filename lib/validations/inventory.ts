import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().min(2, 'Category name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  parentId: z.string().optional(),
})

export const itemSchema = z.object({
  sku: z.string().optional(), // auto-generated (ITM-xxxxx) when left blank
  barcode: z.string().optional(), // one barcode = one product (unique)
  barcodeType: z.enum(['CODE128', 'EAN13', 'EAN8', 'UPCA', 'UPCE', 'CODE39', 'QR']).default('CODE128'),
  secondaryBarcode: z.string().optional(),
  name: z.string().min(2, 'Item name is required'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  uom: z.string().min(1, 'UOM is required'),
  packing: z.string().optional(),
  vatRate: z.number().min(0).max(1).default(0.2), // 0.20 = 20%, applied on POS sale
  standardCost: z.number().nonnegative().default(0),
  sellingPrice: z.number().nonnegative().default(0),
  reorderPoint: z.number().nonnegative().default(0),
  reorderQty: z.number().nonnegative().default(0),
  expiryDate: z.string().optional(),
})

export const warehouseSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  address: z.string().optional(),
})

export const stockAdjustmentSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  transactionType: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number(),
  unitCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  transactionDate: z.string().min(1),
})

export const stockTransferSchema = z.object({
  fromWarehouseId: z.string().min(1, 'Source warehouse is required'),
  toWarehouseId: z.string().min(1, 'Destination warehouse is required'),
  transferDate: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.number().positive('Quantity must be positive'),
    unitCost: z.number().nonnegative().default(0),
  })).min(1, 'At least one item is required'),
})

export const cycleCountSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  countDate: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    itemId: z.string().min(1),
    systemQty: z.number().nonnegative(),
    countedQty: z.number().nonnegative().optional(),
    notes: z.string().optional(),
  })).min(1, 'At least one item is required'),
})

export const serialNumberSchema = z.object({
  serialCode: z.string().optional(), // auto-generated (SN-xxxxx) when left blank
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  notes: z.string().optional(),
})

export type ItemInput = z.infer<typeof itemSchema>

export const itemBatchSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  quantityOnHand: z.number().int().nonnegative(),
  manufacturingDate: z.string().optional(),
  expiryDate: z.string().optional(),
  receivedDate: z.string().optional(),
})
export type ItemBatchInput = z.infer<typeof itemBatchSchema>

export const itemBatchAdjustSchema = z.object({
  batchId: z.number().int().positive(),
  quantityChange: z.number().int(),
  reason: z.enum(['Expired', 'Damaged', 'Stock Count', 'Theft', 'Found']),
  adjustedBy: z.string().optional(),
})
export type ItemBatchAdjustInput = z.infer<typeof itemBatchAdjustSchema>
export type WarehouseInput = z.infer<typeof warehouseSchema>
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>
export type StockTransferInput = z.infer<typeof stockTransferSchema>
export type CycleCountInput = z.infer<typeof cycleCountSchema>
export type SerialNumberInput = z.infer<typeof serialNumberSchema>
