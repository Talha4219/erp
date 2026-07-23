import { z } from 'zod'

export const vendorSchema = z.object({
  vendorCode: z.string().min(1, 'Vendor code is required'),
  name: z.string().min(2, 'Vendor name is required'),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  paymentTerms: z.number().nonnegative().optional(),
  creditLimit: z.number().nonnegative().optional(),
})

const poLineItemSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().min(0).max(100).default(0),
})

export const purchaseOrderSchema = z.object({
  vendorId: z.string().min(1, 'Vendor is required'),
  orderDate: z.string().min(1, 'Order date is required'),
  deliveryDate: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(poLineItemSchema).min(1, 'At least one item required'),
})

export const purchaseReturnPatchSchema = z.object({
  status: z.enum(['DRAFT', 'APPROVED', 'SHIPPED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
})

export const rfqPatchSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'CLOSED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
})

export const supplierQuotationPatchSchema = z.object({
  status: z.enum(['RECEIVED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED']).optional(),
  notes: z.string().optional(),
})

export const vendorInvoicePatchSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  totalAmount: z.number().nonnegative().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

export type VendorInput = z.infer<typeof vendorSchema>
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>
