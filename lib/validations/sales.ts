import { z } from 'zod'

export const customerSchema = z.object({
  customerCode: z.string().min(1, 'Customer code is required'),
  name: z.string().min(2, 'Customer name is required'),
  title: z.string().max(10).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  creditLimit: z.number().nonnegative().optional(),
  paymentTerms: z.number().nonnegative().optional(),
  dateOfBirth: z.string().optional(),
  marketingOptIn: z.boolean().optional(),
  gdprConsentDate: z.string().optional(),
  dataRetentionConsent: z.boolean().optional(),
})

const salesLineItemSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
})

export const quotationSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  quotationDate: z.string().min(1, 'Quotation date is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  notes: z.string().optional(),
  lineItems: z.array(salesLineItemSchema).min(1, 'At least one item required'),
})

export const salesOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  orderDate: z.string().min(1, 'Order date is required'),
  deliveryDate: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(salesLineItemSchema).min(1, 'At least one item required'),
})

const invoiceLineItemSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
})

export const customerInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  soId: z.string().optional(),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  notes: z.string().optional(),
  lineItems: z.array(invoiceLineItemSchema).min(1, 'At least one line item required'),
})

export const paymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  method: z.string().min(1, 'Payment method is required'),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export const creditNotePatchSchema = z.object({
  status: z.enum(['DRAFT', 'ISSUED', 'APPLIED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
})

export const deliveryNotePatchSchema = z.object({
  status: z.enum(['DRAFT', 'DISPATCHED', 'DELIVERED', 'CANCELLED']).optional(),
  deliveryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export const quotationPatchSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
})

export type CustomerInput = z.infer<typeof customerSchema>
export type QuotationInput = z.infer<typeof quotationSchema>
export type SalesOrderInput = z.infer<typeof salesOrderSchema>
export type CustomerInvoiceInput = z.infer<typeof customerInvoiceSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
