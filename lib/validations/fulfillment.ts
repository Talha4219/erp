import { z } from 'zod'

export const fulfillmentMethodEnum = z.enum([
  'COMPANY_DELIVERY', 'CUSTOMER_PICKUP', 'COURIER',
])

export const fulfillmentStatusEnum = z.enum([
  'DRAFT', 'APPROVED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED',
  'COLLECTED', 'RETURNED', 'CANCELLED', 'FAILED',
])

export const vehicleStatusEnum = z.enum(['AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE'])
export const driverStatusEnum = z.enum(['AVAILABLE', 'ON_DELIVERY', 'OFF_DUTY', 'ON_LEAVE'])
export const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])

export const fulfillmentOrderItemSchema = z.object({
  soItemId: z.string().optional(),
  itemId: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive(),
})

export const createFulfillmentOrderSchema = z.object({
  soId: z.string().min(1, 'Sales Order is required'),
  warehouseId: z.string().optional(),
  method: fulfillmentMethodEnum,
  deliveryAddress: z.string().optional(),
  pickupLocation: z.string().optional(),
  priority: priorityEnum.default('MEDIUM'),
  requestedDate: z.string().optional(),
  notes: z.string().optional(),
  assignedDriverId: z.string().nullable().optional(),
  assignedVehicleId: z.string().nullable().optional(),
  lineItems: z.array(fulfillmentOrderItemSchema).min(1),
})

export const updateFulfillmentOrderSchema = z.object({
  warehouseId: z.string().optional(),
  deliveryAddress: z.string().optional(),
  pickupLocation: z.string().optional(),
  priority: priorityEnum.optional(),
  requestedDate: z.string().optional(),
  notes: z.string().optional(),
  assignedDriverId: z.string().nullable().optional(),
  assignedVehicleId: z.string().nullable().optional(),
})

export const vehicleSchema = z.object({
  vehicleNumber: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  type: z.string().optional(),
  year: z.number().int().optional(),
  capacity: z.number().positive().optional(),
  capacityUnit: z.string().default('kg'),
  fuelType: z.string().optional(),
  registrationNo: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  status: vehicleStatusEnum.default('AVAILABLE'),
  notes: z.string().optional(),
})

export const driverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  licenseNumber: z.string().optional(),
  contactNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  status: driverStatusEnum.default('AVAILABLE'),
  assignedVehicleId: z.string().nullable().optional(),
  notes: z.string().optional(),
})

export const courierShipmentSchema = z.object({
  fulfillmentId: z.string().min(1),
  courierName: z.string().min(1),
  trackingNumber: z.string().optional(),
  shipmentDate: z.string().min(1),
  estimatedDelivery: z.string().optional(),
  weight: z.number().positive().optional(),
  charges: z.number().nonnegative().optional(),
  notes: z.string().optional(),
})

export const returnRequestSchema = z.object({
  fulfillmentId: z.string().optional(),
  soId: z.string().optional(),
  customerId: z.string().min(1, 'Customer is required'),
  warehouseId: z.string().optional(),
  returnDate: z.string().min(1),
  reason: z.string().min(1, 'Reason is required'),
  resolution: z.enum(['REFUND', 'REPLACEMENT', 'CREDIT_NOTE']).optional(),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    itemId: z.string().optional(),
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative().default(0),
    condition: z.string().optional(),
  })).min(1),
})

export const fulfillmentSettingsSchema = z.object({
  notes: z.string().optional(),
})

export type CreateFulfillmentOrderInput = z.infer<typeof createFulfillmentOrderSchema>
export type UpdateFulfillmentOrderInput = z.infer<typeof updateFulfillmentOrderSchema>
export type VehicleInput = z.infer<typeof vehicleSchema>
export type DriverInput = z.infer<typeof driverSchema>
export type CourierShipmentInput = z.infer<typeof courierShipmentSchema>
export type ReturnRequestInput = z.infer<typeof returnRequestSchema>
export type FulfillmentSettingsInput = z.infer<typeof fulfillmentSettingsSchema>
