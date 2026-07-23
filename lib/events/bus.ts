type Handler<T> = (payload: T) => Promise<void>

class EventBus {
  private handlers = new Map<string, Handler<unknown>[]>()

  on<T>(event: string, handler: Handler<T>) {
    const list = this.handlers.get(event) ?? []
    list.push(handler as Handler<unknown>)
    this.handlers.set(event, list)
  }

  async emit<T>(event: string, payload: T) {
    const handlers = this.handlers.get(event) ?? []
    await Promise.allSettled(handlers.map((h) => h(payload as unknown)))
  }
}

export const eventBus = new EventBus()

// ─── Typed event payloads ─────────────────────────────────────────────────────

export type GrnPostedPayload        = { grnId: string; poId: string; vendorId: string; totalAmount: number; userId: string }
export type InvoicePaidPayload      = { invoiceId: string; customerId: string; amount: number; userId: string }
export type PayrollApprovedPayload  = { payrollId: string; employeeId: string; netSalary: number; month: number; year: number; userId: string }
export type StockBelowReorderPayload = { itemId: string; itemName: string; sku: string; currentQty: number; reorderPoint: number }
export type LeaveApprovedPayload    = { leaveId: string; employeeId: string; approverId: string }
export type WorkflowActionPayload   = { instanceId: string; entityType: string; entityId: string; action: string; actorId: string }
export type SalesOrderConfirmedPayload = { soId: string; customerId: string; totalAmount: number }
export type DeliveryNoteDispatchedPayload = {
  dnId: string; dnNumber: string; soId: string; customerId: string; userId: string
  lineItems: Array<{ itemId?: string | null; description: string; deliveredQty: number }>
}
// ── Procurement lifecycle events ──────────────────────────────────────────────
export type PrSubmittedPayload  = { prId: string; prNumber: string; requestedById: string; department?: string | null; totalAmount: number }
export type PrApprovedPayload   = { prId: string; prNumber: string; requestedById: string; approverId: string }
export type PrRejectedPayload   = { prId: string; prNumber: string; requestedById: string; approverId: string; reason?: string }
export type PoCreatedPayload    = { poId: string; poNumber: string; vendorId: string; grandTotal: number; userId: string }
export type PoApprovedPayload   = { poId: string; poNumber: string; vendorId: string; grandTotal: number; userId: string }
export type VendorInvoiceCreatedPayload = { invoiceId: string; invoiceNumber: string; vendorId: string; totalAmount: number; dueDate: Date; userId: string }
export type VendorPaymentCompletedPayload = { paymentId: string; vendorId: string; amount: number; poId?: string; userId: string }
// ── POS lifecycle events ──────────────────────────────────────────────────────
export type PosSaleCompletedPayload = {
  orderId: number; netTotal: number; vatAmount: number; grandTotal: number
  totalCost: number // COGS at the warehouse avg cost of each line
  paymentMethod: string; userId: string
}
export type PosReturnProcessedPayload = {
  returnId: number; orderId: number
  refundGross: number; refundNet: number; refundVat: number
  restockCost: number // 0 when nothing was restocked (legacy lines)
  userId: string
}

// ── Fulfillment lifecycle events ───────────────────────────────────────────
export type FulfillmentCreatedPayload = { fulfillmentId: string; fulfillmentNumber: string; soId: string; customerId: string; method: string; userId: string }
export type FulfillmentStatusChangedPayload = { fulfillmentId: string; fulfillmentNumber: string; fromStatus: string; toStatus: string; userId: string }
export type FulfillmentDispatchedPayload = { fulfillmentId: string; fulfillmentNumber: string; soId: string; customerId: string; userId: string; driverId?: string; vehicleId?: string }
export type FulfillmentDeliveredPayload = { fulfillmentId: string; fulfillmentNumber: string; soId: string; customerId: string; userId: string }
export type GoodsReleaseCompletedPayload = { fulfillmentId: string; releaseNumber: string; userId: string }
export type ReturnSubmittedPayload = { returnId: string; returnNumber: string; customerId: string; userId: string }
