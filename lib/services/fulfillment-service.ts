import prisma from '@/lib/prisma'
import { nextDocNumber } from '@/lib/services/numbering'
import { eventBus } from '@/lib/events/bus'
import { companyScope } from '@/lib/company-scope'

// ── Orders ──────────────────────────────────────────────────────────────

export async function listOrders(companyId: string, page: number, limit: number) {
  const skip = (page - 1) * limit
  const [orders, total] = await Promise.all([
    prisma.fulfillmentOrder.findMany({
      where: { deletedAt: null, ...companyScope(companyId) },
      select: { id: true, fulfillmentNumber: true, soId: true, customerId: true, warehouseId: true, method: true, status: true, priority: true, deliveryAddress: true, pickupLocation: true, requestedDate: true, notes: true, assignedDriverId: true, assignedVehicleId: true, companyId: true, createdAt: true, updatedAt: true, customer: { select: { id: true, name: true, email: true, phone: true } }, lineItems: { select: { id: true, itemId: true, description: true, quantity: true } } },
      orderBy: { createdAt: 'desc' }, take: limit, skip,
    }),
    prisma.fulfillmentOrder.count({ where: { deletedAt: null, ...companyScope(companyId) } }),
  ])
  return { orders, total, page, limit }
}

export async function createOrder(data: {
  soId: string; warehouseId?: string; method: string; deliveryAddress?: any; pickupLocation?: string
  priority?: string; requestedDate?: string; notes?: string; assignedDriverId?: string; assignedVehicleId?: string
  lineItems: { soItemId?: string; itemId?: string; description: string; quantity: number }[]
}, userId: string, companyId: string) {
  const fulfillmentNumber = await nextDocNumber('fulfillment_order')
  const so = await prisma.salesOrder.findUnique({ where: { id: data.soId }, select: { customerId: true } })
  if (!so) throw new Error('Sales order not found')

  const order = await prisma.fulfillmentOrder.create({
    data: {
      fulfillmentNumber, soId: data.soId, customerId: so.customerId, companyId: companyId ?? undefined,
      warehouseId: data.warehouseId ?? undefined, method: data.method as any,
      deliveryAddress: data.deliveryAddress ?? undefined, pickupLocation: data.pickupLocation ?? undefined,
      priority: data.priority as any, requestedDate: data.requestedDate ? new Date(data.requestedDate) : undefined,
      notes: data.notes, assignedDriverId: data.assignedDriverId ?? undefined, assignedVehicleId: data.assignedVehicleId ?? undefined,
      lineItems: { create: data.lineItems.map(li => ({ soItemId: li.soItemId, itemId: li.itemId, description: li.description, quantity: li.quantity })) },
    },
    select: { id: true, fulfillmentNumber: true, soId: true, customerId: true, method: true, status: true, priority: true, notes: true, createdAt: true, customer: { select: { id: true, name: true, email: true, phone: true } }, lineItems: { select: { id: true, itemId: true, description: true, quantity: true } } },
  })

  eventBus.emit('fulfillment.created', { fulfillmentId: order.id, fulfillmentNumber: order.fulfillmentNumber, soId: order.soId, customerId: order.customerId, method: order.method, userId })
  return order
}

export function getOrder(id: string) {
  return prisma.fulfillmentOrder.findUnique({
    where: { id }, include: { customer: true, salesOrder: true, lineItems: { include: { item: true } }, shipments: { include: { driver: true, vehicle: true } }, driver: true, vehicle: true, warehouse: true },
  })
}

export async function updateOrder(id: string, data: Record<string, unknown>) {
  const allowed = ['warehouseId', 'deliveryAddress', 'pickupLocation', 'priority', 'requestedDate', 'notes', 'assignedDriverId', 'assignedVehicleId']
  const updateData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = key === 'requestedDate' ? new Date(data[key] as string) : data[key]
  }
  return prisma.fulfillmentOrder.update({ where: { id }, data: updateData as any })
}

export async function softDeleteOrder(id: string) {
  const order = await prisma.fulfillmentOrder.findUnique({ where: { id } })
  if (!order) throw new Error('Not found')
  if (['DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'COLLECTED'].includes(order.status)) throw new Error('Cannot delete order in active or completed status')
  return prisma.fulfillmentOrder.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── State Machine ───────────────────────────────────────────────────────

export async function approveOrder(id: string, userId: string) {
  const order = await prisma.fulfillmentOrder.findUnique({ where: { id } })
  if (!order) throw new Error('Not found')
  if (order.status !== 'DRAFT') throw new Error(`Cannot approve order in ${order.status} status`)

  const updated = await prisma.fulfillmentOrder.update({ where: { id }, data: { status: 'APPROVED' } })
  eventBus.emit('fulfillment.status_changed', { fulfillmentId: id, fulfillmentNumber: updated.fulfillmentNumber, fromStatus: order.status, toStatus: 'APPROVED', userId })
  return updated
}

export async function dispatchOrder(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.fulfillmentOrder.findUnique({ where: { id } })
    if (!order) throw new Error('Not found')
    if (order.status !== 'APPROVED') throw new Error(`Cannot dispatch order in ${order.status} status`)

    const oldStatus = order.status
    const shipmentNumber = await nextDocNumber('shipment')

    const updated = await tx.fulfillmentOrder.update({
      where: { id }, data: { status: 'DISPATCHED', shipments: { create: { shipmentNumber, status: 'IN_TRANSIT' } } },
    })
    await tx.shipment.updateMany({
      where: { fulfillmentId: id, status: 'PENDING' },
      data: { status: 'IN_TRANSIT', dispatchedAt: new Date() },
    })
    if (order.assignedDriverId) {
      await tx.driver.update({ where: { id: order.assignedDriverId }, data: { status: 'ON_DELIVERY' } }).catch(() => {})
    }
    if (order.assignedVehicleId) {
      await tx.vehicle.update({ where: { id: order.assignedVehicleId }, data: { status: 'ASSIGNED' } }).catch(() => {})
    }

    eventBus.emit('fulfillment.status_changed', { fulfillmentId: id, fulfillmentNumber: updated.fulfillmentNumber, fromStatus: oldStatus, toStatus: 'DISPATCHED', userId })
    eventBus.emit('fulfillment.dispatched', { fulfillmentId: id, fulfillmentNumber: updated.fulfillmentNumber, soId: updated.soId, customerId: updated.customerId, userId, driverId: order.assignedDriverId ?? undefined, vehicleId: order.assignedVehicleId ?? undefined })
    return updated
  })
}

export async function deliverOrder(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.fulfillmentOrder.findUnique({ where: { id } })
    if (!order) throw new Error('Not found')

    const isPickup = order.method === 'CUSTOMER_PICKUP'
    const validStatuses = isPickup ? ['APPROVED', 'DISPATCHED'] : ['DISPATCHED', 'IN_TRANSIT']
    if (!validStatuses.includes(order.status)) throw new Error(`Cannot deliver order in ${order.status} status`)

    const newStatus = isPickup ? 'COLLECTED' : 'DELIVERED'
    const oldStatus = order.status

    const updated = await tx.fulfillmentOrder.update({ where: { id }, data: { status: newStatus } })
    await tx.shipment.updateMany({
      where: { fulfillmentId: id, status: { in: ['IN_TRANSIT', 'DISPATCHED'] } },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    })
    if (order.assignedDriverId) {
      await tx.driver.update({ where: { id: order.assignedDriverId }, data: { status: 'AVAILABLE' } }).catch(() => {})
    }
    if (order.assignedVehicleId) {
      await tx.vehicle.update({ where: { id: order.assignedVehicleId }, data: { status: 'AVAILABLE' } }).catch(() => {})
    }

    eventBus.emit('fulfillment.status_changed', { fulfillmentId: id, fulfillmentNumber: updated.fulfillmentNumber, fromStatus: oldStatus, toStatus: newStatus, userId })
    eventBus.emit('fulfillment.delivered', { fulfillmentId: id, fulfillmentNumber: updated.fulfillmentNumber, soId: updated.soId, customerId: updated.customerId, userId })
    return updated
  })
}

export async function cancelOrder(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.fulfillmentOrder.findUnique({ where: { id } })
    if (!order) throw new Error('Not found')
    if (['DELIVERED', 'CANCELLED', 'COLLECTED'].includes(order.status)) throw new Error(`Cannot cancel order in ${order.status} status`)

    const updated = await tx.fulfillmentOrder.update({ where: { id }, data: { status: 'CANCELLED' } })

    // Cleanup driver/vehicle
    if (order.assignedDriverId) {
      await tx.driver.update({ where: { id: order.assignedDriverId }, data: { status: 'AVAILABLE' } }).catch(() => {})
    }
    if (order.assignedVehicleId) {
      await tx.vehicle.update({ where: { id: order.assignedVehicleId }, data: { status: 'AVAILABLE' } }).catch(() => {})
    }
    // Cancel active shipments
    await tx.shipment.updateMany({ where: { fulfillmentId: id, status: { in: ['PENDING', 'IN_TRANSIT'] } }, data: { status: 'CANCELLED' } })

    eventBus.emit('fulfillment.status_changed', { fulfillmentId: id, fulfillmentNumber: updated.fulfillmentNumber, fromStatus: order.status, toStatus: 'CANCELLED', userId })
    return updated
  })
}

// ── Deliveries ──────────────────────────────────────────────────────────

export async function listDeliveries(companyId: string, page: number, limit: number) {
  const skip = (page - 1) * limit
  const where = { deletedAt: null, method: 'COMPANY_DELIVERY' as any, status: { not: 'CANCELLED' as any }, ...companyScope(companyId) }
  const [orders, total] = await Promise.all([
    prisma.fulfillmentOrder.findMany({
      where, select: { id: true, fulfillmentNumber: true, soId: true, customerId: true, method: true, status: true, deliveryAddress: true, requestedDate: true, assignedDriverId: true, assignedVehicleId: true, createdAt: true, customer: { select: { id: true, name: true, email: true, phone: true } }, lineItems: { select: { id: true, description: true, quantity: true } }, driver: { select: { id: true, name: true } }, vehicle: { select: { id: true, vehicleNumber: true } }, shipments: { select: { id: true, status: true, dispatchedAt: true } } },
      orderBy: { requestedDate: 'asc' }, take: limit, skip,
    }),
    prisma.fulfillmentOrder.count({ where }),
  ])
  return { orders, total, page, limit }
}

export function getDelivery(id: string) {
  return prisma.fulfillmentOrder.findUnique({
    where: { id }, include: { customer: true, salesOrder: true, lineItems: { include: { item: true } }, shipments: { include: { driver: true, vehicle: true } }, driver: true, vehicle: true, warehouse: true },
  })
}

// ── Drivers ─────────────────────────────────────────────────────────────

export async function listDrivers(page: number, limit: number) {
  const skip = (page - 1) * limit
  const [drivers, total] = await Promise.all([
    prisma.driver.findMany({ where: { deletedAt: null }, select: { id: true, name: true, licenseNumber: true, contactNumber: true, email: true, status: true, assignedVehicleId: true, notes: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: limit, skip }),
    prisma.driver.count({ where: { deletedAt: null } }),
  ])
  return { drivers, total, page, limit }
}

export function getDriver(id: string) {
  return prisma.driver.findUnique({ where: { id }, include: { vehicle: true, assignments: true, shipments: true, fulfillments: true } })
}

export function createDriver(data: { name: string; licenseNumber?: string; contactNumber?: string; email?: string; address?: string; status?: string; assignedVehicleId?: string; notes?: string }) {
  return prisma.driver.create({
    data: { name: data.name, licenseNumber: data.licenseNumber, contactNumber: data.contactNumber, email: data.email || undefined, address: data.address, status: data.status as any, assignedVehicleId: data.assignedVehicleId, notes: data.notes },
    select: { id: true, name: true, licenseNumber: true, contactNumber: true, email: true, status: true, assignedVehicleId: true, notes: true, createdAt: true },
  })
}

export async function updateDriver(id: string, data: Record<string, unknown>) {
  const allowed = ['name', 'licenseNumber', 'contactNumber', 'email', 'address', 'status', 'assignedVehicleId', 'notes']
  const updateData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = data[key]
  }
  return prisma.driver.update({ where: { id }, data: updateData as any })
}

export async function softDeleteDriver(id: string) {
  const driver = await prisma.driver.findUnique({ where: { id } })
  if (!driver) throw new Error('Not found')
  const activeShipments = await prisma.shipment.count({ where: { driverId: id, status: 'IN_TRANSIT' } })
  if (activeShipments > 0) throw new Error('Cannot delete driver with active shipments')
  return prisma.driver.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Vehicles ────────────────────────────────────────────────────────────

export async function listVehicles(page: number, limit: number) {
  const skip = (page - 1) * limit
  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: limit, skip }),
    prisma.vehicle.count({ where: { deletedAt: null } }),
  ])
  return { vehicles, total, page, limit }
}

export function getVehicle(id: string) {
  return prisma.vehicle.findUnique({ where: { id }, include: { assignments: { include: { driver: true } }, shipments: true, fulfillments: true } })
}

export async function createVehicle(data: Record<string, unknown>) {
  if (!data.vehicleNumber) data.vehicleNumber = await nextDocNumber('vehicle')
  return prisma.vehicle.create({ data: data as any })
}

export async function updateVehicle(id: string, data: Record<string, unknown>) {
  const allowed = ['vehicleNumber', 'make', 'model', 'year', 'capacity', 'capacityUnit', 'fuelType', 'registrationNo', 'insuranceExpiry', 'status', 'notes']
  const updateData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = key === 'insuranceExpiry' && data[key] ? new Date(data[key] as string) : data[key]
  }
  return prisma.vehicle.update({ where: { id }, data: updateData as any })
}

export async function softDeleteVehicle(id: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } })
  if (!vehicle) throw new Error('Not found')
  const activeShipments = await prisma.shipment.count({ where: { vehicleId: id, status: 'IN_TRANSIT' } })
  if (activeShipments > 0) throw new Error('Cannot delete vehicle with active shipments')
  return prisma.vehicle.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Courier ─────────────────────────────────────────────────────────────

export async function listCourierOrders(companyId: string, page: number, limit: number) {
  const skip = (page - 1) * limit
  const where = { deletedAt: null, method: 'COURIER' as any, ...companyScope(companyId) }
  const [orders, total] = await Promise.all([
    prisma.fulfillmentOrder.findMany({
      where, select: { id: true, fulfillmentNumber: true, soId: true, customerId: true, method: true, status: true, deliveryAddress: true, createdAt: true, customer: { select: { id: true, name: true, email: true, phone: true } }, lineItems: { select: { id: true, description: true, quantity: true } }, shipments: { select: { id: true, status: true, trackingNumber: true } }, courierShipments: { select: { id: true, courierName: true, trackingNumber: true, status: true } } },
      orderBy: { createdAt: 'desc' }, take: limit, skip,
    }),
    prisma.fulfillmentOrder.count({ where }),
  ])
  return { orders, total, page, limit }
}

export async function createCourierShipment(data: { fulfillmentId: string; courierName: string; trackingNumber?: string; shipmentDate?: string; estimatedDelivery?: string; weight?: number; charges?: number; notes?: string }) {
  const fulfillment = await prisma.fulfillmentOrder.findUnique({ where: { id: data.fulfillmentId } })
  if (!fulfillment) throw new Error('Fulfillment not found')
  if (['DELIVERED', 'CANCELLED', 'COLLECTED'].includes(fulfillment.status)) throw new Error('Cannot add courier shipment to completed fulfillment')
  if (fulfillment.method !== 'COURIER') throw new Error('Fulfillment method is not COURIER')

  const trackingNumber = data.trackingNumber || `COU-${Date.now()}`
  return prisma.courierShipment.create({
    data: { fulfillmentId: data.fulfillmentId, courierName: data.courierName, trackingNumber, shipmentDate: data.shipmentDate ? new Date(data.shipmentDate) : new Date(), estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : undefined, weight: data.weight, charges: data.charges, notes: data.notes },
  })
}

export function getCourierShipment(id: string) {
  return prisma.courierShipment.findUnique({ where: { id }, include: { fulfillment: { include: { customer: true, lineItems: true } } } })
}

export function updateCourierShipment(id: string, data: Record<string, unknown>) {
  const allowed = ['courierName', 'trackingNumber', 'shipmentDate', 'estimatedDelivery', 'weight', 'charges', 'status', 'notes']
  const updateData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = (key === 'shipmentDate' || key === 'estimatedDelivery') && data[key] ? new Date(data[key] as string) : data[key]
  }
  return prisma.courierShipment.update({ where: { id }, data: updateData as any })
}

// ── Pickups ─────────────────────────────────────────────────────────────

export async function listPickups(companyId: string) {
  return prisma.fulfillmentOrder.findMany({
    where: { deletedAt: null, method: 'CUSTOMER_PICKUP', ...companyScope(companyId) },
    select: { id: true, fulfillmentNumber: true, soId: true, customerId: true, method: true, status: true, pickupLocation: true, requestedDate: true, createdAt: true, customer: { select: { id: true, name: true, email: true, phone: true } }, lineItems: { select: { id: true, description: true, quantity: true } } },
    orderBy: { createdAt: 'desc' }, take: 200,
  })
}

export function getPickup(id: string) {
  return prisma.fulfillmentOrder.findUnique({ where: { id }, include: { customer: true, salesOrder: true, lineItems: true, warehouse: true } })
}

// ── Returns ─────────────────────────────────────────────────────────────

export async function listReturns(companyId: string, page: number, limit: number) {
  const skip = (page - 1) * limit
  const where = { deletedAt: null, ...companyScope(companyId) }
  const [returns, total] = await Promise.all([
    prisma.returnRequest.findMany({
      where, select: { id: true, returnNumber: true, fulfillmentId: true, soId: true, customerId: true, warehouseId: true, returnDate: true, reason: true, resolution: true, totalAmount: true, status: true, notes: true, companyId: true, createdAt: true, updatedAt: true, customer: { select: { id: true, name: true, email: true } }, lineItems: { select: { id: true, description: true, quantity: true, unitPrice: true, totalPrice: true, condition: true } }, fulfillment: { select: { id: true, fulfillmentNumber: true } }, so: { select: { id: true, soNumber: true } } },
      orderBy: { createdAt: 'desc' }, take: limit, skip,
    }),
    prisma.returnRequest.count({ where }),
  ])
  return { returns, total, page, limit }
}

export function getReturn(id: string) {
  return prisma.returnRequest.findUnique({ where: { id }, include: { customer: true, lineItems: true, fulfillment: true, so: true, warehouse: true } })
}

export async function createReturn(data: { fulfillmentId?: string; soId?: string; customerId: string; warehouseId?: string; returnDate?: string; reason: string; resolution?: string; notes?: string; lineItems: { itemId?: string; description: string; quantity: number; unitPrice: number; condition?: string }[] }, companyId: string) {
  const returnNumber = await nextDocNumber('return_request')
  const totalAmount = data.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0)

  return prisma.returnRequest.create({
    data: {
      returnNumber, fulfillmentId: data.fulfillmentId, soId: data.soId, customerId: data.customerId,
      companyId: companyId ?? undefined, warehouseId: data.warehouseId,
      returnDate: data.returnDate ? new Date(data.returnDate) : new Date(), reason: data.reason,
      resolution: data.resolution, totalAmount, notes: data.notes,
      lineItems: { create: data.lineItems.map(li => ({ itemId: li.itemId, description: li.description, quantity: li.quantity, unitPrice: li.unitPrice, totalPrice: li.unitPrice * li.quantity, condition: li.condition })) },
    },
    include: { lineItems: true },
  })
}

export async function updateReturn(id: string, data: { status?: string; inspectionNotes?: string; resolution?: string; notes?: string }) {
  const existing = await prisma.returnRequest.findUnique({ where: { id } })
  if (!existing) throw new Error('Not found')

  const updateData: Record<string, unknown> = {}
  if (data.status) updateData.status = data.status
  if (data.inspectionNotes !== undefined) updateData.inspectionNotes = data.inspectionNotes
  if (data.resolution !== undefined) updateData.resolution = data.resolution
  if (data.notes !== undefined) updateData.notes = data.notes

  if (data.status === 'GOODS_RECEIVED' && !existing.goodsReceivedAt) updateData.goodsReceivedAt = new Date()
  if (data.status === 'INSPECTED' && !existing.inspectedAt) updateData.inspectedAt = new Date()
  if (data.status === 'REFUNDED' || data.status === 'REPLACED') updateData.resolvedAt = new Date()

  return prisma.returnRequest.update({ where: { id }, data: updateData as any })
}

// ── Settings ────────────────────────────────────────────────────────────

export async function getFulfillmentSettings(companyId: string) {
  let settings = await prisma.fulfillmentSettings.findUnique({ where: { companyId } })
  if (!settings && companyId) {
    settings = await prisma.fulfillmentSettings.create({ data: { companyId } })
  }
  return settings
}

export async function upsertFulfillmentSettings(companyId: string, data: Record<string, unknown>) {
  return prisma.fulfillmentSettings.upsert({
    where: { companyId }, update: data, create: { companyId, ...data } as any,
  })
}

// ── Dashboard ───────────────────────────────────────────────────────────

export async function getFulfillmentDashboard(companyId: string) {
  const where = { deletedAt: null, ...companyScope(companyId) }
  const today = new Date(new Date().setHours(0, 0, 0, 0))

  const [ordersPending, approvedOrders, inTransit, deliveriesToday, awaitingPickup, returns] = await Promise.all([
    prisma.fulfillmentOrder.count({ where: { ...where, status: 'DRAFT' } }),
    prisma.fulfillmentOrder.count({ where: { ...where, status: 'APPROVED' } }),
    prisma.fulfillmentOrder.count({ where: { ...where, status: 'DISPATCHED' } }),
    prisma.fulfillmentOrder.count({ where: { ...where, status: 'DELIVERED', updatedAt: { gte: today } } }),
    prisma.fulfillmentOrder.count({ where: { ...where, method: 'CUSTOMER_PICKUP', status: { in: ['APPROVED', 'DISPATCHED'] } } }),
    prisma.returnRequest.count({ where: { ...companyScope(companyId), status: 'PENDING', deletedAt: null } }),
  ])

  const recentOrders = await prisma.fulfillmentOrder.findMany({
    where, include: { customer: true, lineItems: true },
    orderBy: { createdAt: 'desc' }, take: 10,
  })

  return { ordersPending, approvedOrders, inTransit, deliveriesToday, awaitingPickup, returns, recentOrders }
}
