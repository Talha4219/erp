/**
 * Domain event handlers — registered once at app startup.
 * Each handler runs inside a Prisma transaction to keep side-effects atomic.
 */
import { eventBus } from './bus'
import type {
  GrnPostedPayload,
  InvoicePaidPayload,
  PayrollApprovedPayload,
  StockBelowReorderPayload,
  DeliveryNoteDispatchedPayload,
  PrSubmittedPayload,
  PrApprovedPayload,
  PrRejectedPayload,
  PoCreatedPayload,
  PoApprovedPayload,
  VendorInvoiceCreatedPayload,
  VendorPaymentCompletedPayload,
  PosSaleCompletedPayload,
  PosReturnProcessedPayload,
  FulfillmentCreatedPayload,
  FulfillmentStatusChangedPayload,
  FulfillmentDispatchedPayload,
  FulfillmentDeliveredPayload,
  GoodsReleaseCompletedPayload,
  ReturnSubmittedPayload,
} from './bus'
import prisma from '@/lib/prisma'
import { createJournalEntry } from '@/lib/services/accounting'
import { createNotification, notifyRole } from '@/lib/services/notification'
import { getStockUnitCost } from '@/lib/stock'
import { round2 } from '@/lib/money'

let registered = false

export function registerEventHandlers() {
  if (registered) return
  registered = true

  // ── GRN Posted → create AP journal entry ─────────────────────────────────
  eventBus.on<GrnPostedPayload>('grn.posted', async ({ grnId, totalAmount, userId }) => {
    try {
      await prisma.$transaction(async (tx) => {
        // Standard accounts: 5000=Inventory/Purchases, 2000=Accounts Payable
        const [inventoryAcc, apAcc] = await Promise.all([
          tx.account.findFirst({ where: { code: '5000', isActive: true } }),
          tx.account.findFirst({ where: { code: '2000', isActive: true } }),
        ])
        if (!inventoryAcc || !apAcc) return // accounts not configured

        await createJournalEntry(tx, {
          description: `GRN stock receipt`,
          date: new Date(),
          reference: `GRN:${grnId}`,
          createdById: userId,
          lines: [
            { debitAccountId: inventoryAcc.id, debitAmount: totalAmount, description: 'Stock receipt — debit inventory' },
            { creditAccountId: apAcc.id, creditAmount: totalAmount, description: 'Stock receipt — credit AP' },
          ],
        })
      })
    } catch { /* journal posting is best-effort */ }
  })

  // ── Invoice Paid → post AR cash receipt ──────────────────────────────────
  eventBus.on<InvoicePaidPayload>('invoice.paid', async ({ invoiceId, amount, userId }) => {
    try {
      await prisma.$transaction(async (tx) => {
        const [cashAcc, arAcc] = await Promise.all([
          tx.account.findFirst({ where: { code: '1100', isActive: true } }),
          tx.account.findFirst({ where: { code: '1200', isActive: true } }),
        ])
        if (!cashAcc || !arAcc) return

        await createJournalEntry(tx, {
          description: 'Customer payment received',
          date: new Date(),
          reference: `INV:${invoiceId}`,
          createdById: userId,
          lines: [
            { debitAccountId: cashAcc.id, debitAmount: amount, description: 'Cash receipt' },
            { creditAccountId: arAcc.id, creditAmount: amount, description: 'AR settlement' },
          ],
        })
      })
    } catch { /* best-effort */ }
  })

  // ── Payroll Approved → post salary journal ────────────────────────────────
  eventBus.on<PayrollApprovedPayload>('payroll.approved', async ({ payrollId, netSalary, userId }) => {
    try {
      await prisma.$transaction(async (tx) => {
        const [salaryAcc, payableAcc] = await Promise.all([
          tx.account.findFirst({ where: { code: '6000', isActive: true } }),
          tx.account.findFirst({ where: { code: '2100', isActive: true } }),
        ])
        if (!salaryAcc || !payableAcc) return

        await createJournalEntry(tx, {
          description: 'Payroll — salary expense',
          date: new Date(),
          reference: `PAY:${payrollId}`,
          createdById: userId,
          lines: [
            { debitAccountId: salaryAcc.id, debitAmount: netSalary, description: 'Salary expense' },
            { creditAccountId: payableAcc.id, creditAmount: netSalary, description: 'Salaries payable' },
          ],
        })
      })
    } catch { /* best-effort */ }
  })

  // ── POS Sale Completed → post revenue + COGS journal ─────────────────────
  eventBus.on<PosSaleCompletedPayload>('pos.sale_completed', async ({ orderId, netTotal, vatAmount, grandTotal, totalCost, userId }) => {
    try {
      // Account lookups are read-only — keep them outside the transaction so the
      // write transaction stays well inside Prisma's interactive timeout.
      // 1110=Cash, 4100=Sales Revenue, 2100=Current Liabilities (VAT payable),
      // 5100=COGS, 1130=Inventory
      const [cashAcc, revenueAcc, vatAcc, cogsAcc, inventoryAcc] = await Promise.all([
        prisma.account.findFirst({ where: { code: '1110', isActive: true } }),
        prisma.account.findFirst({ where: { code: '4100', isActive: true } }),
        prisma.account.findFirst({ where: { code: '2100', isActive: true } }),
        prisma.account.findFirst({ where: { code: '5100', isActive: true } }),
        prisma.account.findFirst({ where: { code: '1130', isActive: true } }),
      ])
      if (!cashAcc || !revenueAcc) return // accounts not configured

      await prisma.$transaction(async (tx) => {
        await createJournalEntry(tx, {
          description: `POS sale #${orderId}`,
          date: new Date(),
          reference: `POS:${orderId}`,
          createdById: userId,
          lines: [
            { debitAccountId: cashAcc.id, debitAmount: grandTotal, description: 'POS takings — cash/card' },
            { creditAccountId: revenueAcc.id, creditAmount: netTotal, description: 'POS sales revenue' },
            ...(vatAmount > 0 && vatAcc
              ? [{ creditAccountId: vatAcc.id, creditAmount: vatAmount, description: 'Output VAT payable' }]
              : []),
          ],
        })

        // Cost of goods sold at warehouse average cost
        if (totalCost > 0 && cogsAcc && inventoryAcc) {
          await createJournalEntry(tx, {
            description: `POS sale #${orderId} — cost of goods sold`,
            date: new Date(),
            reference: `POS:${orderId}`,
            createdById: userId,
            lines: [
              { debitAccountId: cogsAcc.id, debitAmount: totalCost, description: 'COGS — POS sale' },
              { creditAccountId: inventoryAcc.id, creditAmount: totalCost, description: 'Inventory relieved at avg cost' },
            ],
          })
        }
      }, { timeout: 15_000 }) // remote pooled Postgres — default 5s is too tight
    } catch { /* journal posting is best-effort */ }
  })

  // ── POS Return Processed → reverse revenue (+ COGS when restocked) ───────
  eventBus.on<PosReturnProcessedPayload>('pos.return_processed', async ({ returnId, orderId, refundGross, refundNet, refundVat, restockCost, userId }) => {
    try {
      const [cashAcc, revenueAcc, vatAcc, cogsAcc, inventoryAcc] = await Promise.all([
        prisma.account.findFirst({ where: { code: '1110', isActive: true } }),
        prisma.account.findFirst({ where: { code: '4100', isActive: true } }),
        prisma.account.findFirst({ where: { code: '2100', isActive: true } }),
        prisma.account.findFirst({ where: { code: '5100', isActive: true } }),
        prisma.account.findFirst({ where: { code: '1130', isActive: true } }),
      ])
      if (!cashAcc || !revenueAcc) return

      await prisma.$transaction(async (tx) => {
        await createJournalEntry(tx, {
          description: `POS return #${returnId} (order #${orderId})`,
          date: new Date(),
          reference: `POS-RTN:${returnId}`,
          createdById: userId,
          lines: [
            { debitAccountId: revenueAcc.id, debitAmount: refundNet, description: 'Revenue reversal — POS return' },
            ...(refundVat > 0 && vatAcc
              ? [{ debitAccountId: vatAcc.id, debitAmount: refundVat, description: 'Output VAT reversal' }]
              : []),
            { creditAccountId: cashAcc.id, creditAmount: refundGross, description: 'Cash refunded' },
          ],
        })

        // Stock came back — reverse the COGS at the restock cost
        if (restockCost > 0 && cogsAcc && inventoryAcc) {
          await createJournalEntry(tx, {
            description: `POS return #${returnId} — COGS reversal`,
            date: new Date(),
            reference: `POS-RTN:${returnId}`,
            createdById: userId,
            lines: [
              { debitAccountId: inventoryAcc.id, debitAmount: restockCost, description: 'Inventory restocked' },
              { creditAccountId: cogsAcc.id, creditAmount: restockCost, description: 'COGS reversal — POS return' },
            ],
          })
        }
      }, { timeout: 15_000 }) // remote pooled Postgres — default 5s is too tight
    } catch { /* journal posting is best-effort */ }
  })

  // ── Stock Below Reorder → auto Purchase Requisition ──────────────────────
  eventBus.on<StockBelowReorderPayload>('stock.below_reorder', async ({ itemId, itemName, sku, currentQty, reorderPoint }) => {
    try {
      // Check if an open PR for this item already exists to avoid duplicates
      const existing = await prisma.purchaseRequisition.findFirst({
        where: {
          lineItems: { some: { itemId } },
          status: { in: ['DRAFT', 'PENDING'] },
        },
      })
      if (existing) return

      const count = await prisma.purchaseRequisition.count()
      const prNumber = `PR-AUTO-${String(count + 1).padStart(5, '0')}`
      const reorderQty = reorderPoint * 2 // simple default: order 2× reorder point

      await prisma.purchaseRequisition.create({
        data: {
          prNumber,
          requestedById: 'system',
          requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
          status: 'DRAFT',
          priority: 'HIGH',
          notes: `Auto-generated: ${sku} stock (${currentQty}) fell below reorder point (${reorderPoint})`,
          totalAmount: 0,
          lineItems: {
            create: [{
              itemId,
              description: itemName,
              quantity: reorderQty,
              uom: 'EA',
              estimatedUnitPrice: 0,
              totalPrice: 0,
            }],
          },
        },
      })

      // Notify procurement team
      await notifyRole('MANAGER', {
        title: 'Low Stock Alert — Auto PR Created',
        body: `${itemName} (${sku}) is below reorder point. A draft purchase requisition has been created.`,
        type: 'WARNING',
        entityType: 'Item',
        entityId: itemId,
        actionUrl: '/procurement/purchase-requests',
      })
    } catch { /* best-effort */ }
  })

  // ── Invoice Paid → notify finance team ───────────────────────────────────
  eventBus.on<InvoicePaidPayload>('invoice.paid', async ({ invoiceId, amount, userId }) => {
    await createNotification({
      userId,
      title: 'Payment recorded',
      body: `Invoice payment of ${amount.toFixed(2)} posted to ledger.`,
      type: 'SUCCESS',
      entityType: 'CustomerInvoice',
      entityId: invoiceId,
      actionUrl: `/sales/invoices/${invoiceId}`,
    })
  })

  // ── PR Submitted → notify procurement managers ────────────────────────────
  eventBus.on<PrSubmittedPayload>('pr.submitted', async ({ prId, prNumber, department, totalAmount }) => {
    await notifyRole('MANAGER', {
      title: `Purchase Requisition Submitted — ${prNumber}`,
      body: `${department ?? 'A department'} submitted a purchase request for ${totalAmount > 0 ? `£${totalAmount.toFixed(2)}` : 'review'}. Action required.`,
      type: 'ACTION_REQUIRED',
      entityType: 'PurchaseRequisition',
      entityId: prId,
      actionUrl: `/procurement/purchase-requests/${prId}`,
    })
  })

  // ── PR Approved → notify requester + procurement ──────────────────────────
  eventBus.on<PrApprovedPayload>('pr.approved', async ({ prId, prNumber, requestedById }) => {
    await Promise.allSettled([
      createNotification({
        userId: requestedById,
        title: `Your Purchase Request Approved — ${prNumber}`,
        body: 'Your purchase request has been approved and is proceeding to procurement.',
        type: 'SUCCESS',
        entityType: 'PurchaseRequisition',
        entityId: prId,
        actionUrl: `/procurement/purchase-requests/${prId}`,
      }),
      notifyRole('MANAGER', {
        title: `PR Approved — Create PO for ${prNumber}`,
        body: 'An approved purchase request is ready for purchase order creation.',
        type: 'INFO',
        entityType: 'PurchaseRequisition',
        entityId: prId,
        actionUrl: `/procurement/purchase-requests/${prId}`,
      }),
    ])
  })

  // ── PR Rejected → notify requester ───────────────────────────────────────
  eventBus.on<PrRejectedPayload>('pr.rejected', async ({ prId, prNumber, requestedById, reason }) => {
    await createNotification({
      userId: requestedById,
      title: `Purchase Request Rejected — ${prNumber}`,
      body: reason ? `Reason: ${reason}` : 'Your purchase request was not approved. Please review and resubmit.',
      type: 'ERROR',
      entityType: 'PurchaseRequisition',
      entityId: prId,
      actionUrl: `/procurement/purchase-requests/${prId}`,
    })
  })

  // ── PO Created → notify finance + budget awareness ───────────────────────
  eventBus.on<PoCreatedPayload>('po.created', async ({ poId, poNumber, grandTotal }) => {
    await notifyRole('MANAGER', {
      title: `Purchase Order Created — ${poNumber}`,
      body: `A new purchase order for £${grandTotal.toFixed(2)} is pending approval.`,
      type: 'INFO',
      entityType: 'PurchaseOrder',
      entityId: poId,
      actionUrl: `/procurement/purchase-orders/${poId}`,
    })
  })

  // ── PO Approved → notify inventory team to expect goods ──────────────────
  eventBus.on<PoApprovedPayload>('po.approved', async ({ poId, poNumber, vendorId, grandTotal }) => {
    try {
      const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { name: true } })
      await notifyRole('OPERATOR', {
        title: `Purchase Order Approved — Expect Delivery`,
        body: `PO ${poNumber} from ${vendor?.name ?? 'supplier'} (£${grandTotal.toFixed(2)}) is approved. Prepare to receive goods.`,
        type: 'INFO',
        entityType: 'PurchaseOrder',
        entityId: poId,
        actionUrl: `/procurement/purchase-orders/${poId}`,
      })
    } catch { /* best-effort */ }
  })

  // ── Vendor Invoice Created → notify finance/AP team ──────────────────────
  eventBus.on<VendorInvoiceCreatedPayload>('vendor_invoice.created', async ({ invoiceId, invoiceNumber, vendorId, totalAmount, dueDate }) => {
    try {
      const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { name: true } })
      const dueDays = Math.ceil((dueDate.getTime() - Date.now()) / (86400 * 1000))
      const urgency = dueDays <= 7 ? 'ACTION_REQUIRED' : 'INFO'
      await notifyRole('MANAGER', {
        title: `Supplier Invoice — ${invoiceNumber}`,
        body: `Invoice from ${vendor?.name ?? 'supplier'} for £${totalAmount.toFixed(2)} is due in ${dueDays} day${dueDays !== 1 ? 's' : ''}. Payment required.`,
        type: urgency,
        entityType: 'VendorInvoice',
        entityId: invoiceId,
        actionUrl: `/procurement/purchase-invoices/${invoiceId}`,
      })
    } catch { /* best-effort */ }
  })

  // ── Vendor Payment Completed → post AP settlement journal ─────────────────
  eventBus.on<VendorPaymentCompletedPayload>('vendor_payment.completed', async ({ paymentId, amount, userId }) => {
    try {
      await prisma.$transaction(async (tx) => {
        const [cashAcc, apAcc] = await Promise.all([
          tx.account.findFirst({ where: { code: '1100', isActive: true } }),
          tx.account.findFirst({ where: { code: '2000', isActive: true } }),
        ])
        if (!cashAcc || !apAcc) return

        await createJournalEntry(tx, {
          description: 'Supplier payment — AP settlement',
          date: new Date(),
          reference: `VPAY:${paymentId}`,
          createdById: userId,
          lines: [
            { debitAccountId: apAcc.id, debitAmount: amount, description: 'Accounts payable cleared' },
            { creditAccountId: cashAcc.id, creditAmount: amount, description: 'Cash disbursement' },
          ],
        })
      })
      // Vendor payment completion recorded via journal entry above
    } catch { /* best-effort */ }
  })

  // ── Fulfillment Created → notify relevant teams ─────────────────────────
  eventBus.on<FulfillmentCreatedPayload>('fulfillment.created', async ({ fulfillmentId, fulfillmentNumber, method }) => {
    try {
      await notifyRole('OPERATOR', {
        title: `Fulfillment Order Created — ${fulfillmentNumber}`,
        body: `Fulfillment order #${fulfillmentNumber} created via ${method.replace(/_/g, ' ')} method. Ready for processing.`,
        type: 'INFO',
        entityType: 'FulfillmentOrder',
        entityId: fulfillmentId,
        actionUrl: `/fulfillment/orders/${fulfillmentId}`,
      })
    } catch { /* best-effort */ }
  })

  // ── Fulfillment Status Changed → log notification ───────────────────────
  eventBus.on<FulfillmentStatusChangedPayload>('fulfillment.status_changed', async ({ fulfillmentId, fulfillmentNumber, fromStatus, toStatus, userId }) => {
    try {
      await createNotification({
        userId,
        title: `Fulfillment Updated — ${fulfillmentNumber}`,
        body: `Status changed from ${fromStatus} to ${toStatus}.`,
        type: 'INFO',
        entityType: 'FulfillmentOrder',
        entityId: fulfillmentId,
        actionUrl: `/fulfillment/orders/${fulfillmentId}`,
      })
    } catch { /* best-effort */ }
  })

  // ── Fulfillment Dispatched → notify customer + reduce stock ────────────
  eventBus.on<FulfillmentDispatchedPayload>('fulfillment.dispatched', async ({ fulfillmentId, fulfillmentNumber }) => {
    try {
      // Notify warehouse operators
      await notifyRole('OPERATOR', {
        title: `Shipment Dispatched — ${fulfillmentNumber}`,
        body: `Fulfillment #${fulfillmentNumber} has been dispatched.`,
        type: 'INFO',
        entityType: 'FulfillmentOrder',
        entityId: fulfillmentId,
        actionUrl: `/fulfillment/orders/${fulfillmentId}`,
      })
    } catch { /* best-effort */ }
  })

  // ── Fulfillment Delivered → update SalesOrder status if fully fulfilled ─
  eventBus.on<FulfillmentDeliveredPayload>('fulfillment.delivered', async ({ soId }) => {
    try {
      await prisma.$transaction(async (tx) => {
        // Check if all fulfillment orders for this SO are delivered
        const allFulfillments = await tx.fulfillmentOrder.findMany({
          where: { soId, deletedAt: null },
          select: { status: true },
        })
        const allDelivered = allFulfillments.every((f) =>
          ['DELIVERED', 'COLLECTED', 'RELEASED', 'CANCELLED'].includes(f.status)
        )
        if (allDelivered) {
          await tx.salesOrder.update({
            where: { id: soId },
            data: { status: 'DELIVERED' },
          })
        }
      })
    } catch { /* best-effort */ }
  })

  // ── Goods Release Completed → notify ──────────────────────────────────
  eventBus.on<GoodsReleaseCompletedPayload>('goods_release.completed', async ({ fulfillmentId, releaseNumber, userId }) => {
    try {
      await createNotification({
        userId,
        title: `Goods Released — ${releaseNumber}`,
        body: 'Goods have been released successfully.',
        type: 'SUCCESS',
        entityType: 'GoodsRelease',
        entityId: releaseNumber,
        actionUrl: `/fulfillment/orders/${fulfillmentId}`,
      })
    } catch { /* best-effort */ }
  })

  // ── Return Submitted → notify customer service ─────────────────────────
  eventBus.on<ReturnSubmittedPayload>('return.submitted', async ({ returnId, returnNumber }) => {
    try {
      await notifyRole('MANAGER', {
        title: `Return Request Submitted — ${returnNumber}`,
        body: 'A new return request requires review and approval.',
        type: 'ACTION_REQUIRED',
        entityType: 'ReturnRequest',
        entityId: returnId,
        actionUrl: `/fulfillment/returns/${returnId}`,
      })
    } catch { /* best-effort */ }
  })

  // ── Delivery Note Dispatched → reduce stock + post COGS ─────────────────
  eventBus.on<DeliveryNoteDispatchedPayload>('delivery_note.dispatched', async ({ dnId, dnNumber, soId, userId, lineItems }) => {
    try {
      await prisma.$transaction(async (tx) => {
        const today = new Date()

        // Parallelise stock lookups, then batch ledger creates
        const validLines = lineItems.filter((l): l is typeof l & { itemId: string } => !!l.itemId && l.deliveredQty > 0)
        const ledgerData = await Promise.all(
          validLines.map(async (line) => {
            const ws = await tx.warehouseStock.findFirst({ where: { itemId: line.itemId } })
            const unitCost = ws ? Number(ws.avgCost) : await getStockUnitCost(tx, line.itemId, '')
            return {
              itemId: line.itemId,
              warehouseId: ws?.warehouseId ?? '',
              transactionType: 'OUT' as const,
              quantity: -line.deliveredQty,
              unitCost,
              totalCost: round2(unitCost * line.deliveredQty),
              referenceType: 'SO' as const,
              referenceId: dnId,
              notes: `Dispatch — ${dnNumber}`,
              transactionDate: today,
            }
          })
        )
        await tx.stockLedger.createMany({ data: ledgerData })

        // Decrement warehouse stock (re-fetch within transaction to get stable refs)
        for (const line of validLines) {
          await tx.warehouseStock.updateMany({
            where: { itemId: line.itemId, quantity: { gte: line.deliveredQty } },
            data: { quantity: { decrement: line.deliveredQty } },
          })
        }

        // Auto-post cost-of-goods-sold journal
        const [cogsAcc, inventoryAcc] = await Promise.all([
          tx.account.findFirst({ where: { code: '5100', isActive: true } }),
          tx.account.findFirst({ where: { code: '5000', isActive: true } }),
        ])
        if (cogsAcc && inventoryAcc) {
          // Estimate COGS from SO line items using standardCost on each item
          const soItems = await tx.salesOrderItem.findMany({ where: { soId } })
          const itemIds = soItems.map((li) => li.itemId).filter((id): id is string => !!id)
          const items = itemIds.length
            ? await tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, standardCost: true } })
            : []
          const costMap = new Map(items.map((i) => [i.id, Number(i.standardCost)]))
          const totalCogs = soItems.reduce(
            (s, li) => s + (li.itemId ? (costMap.get(li.itemId) ?? 0) : 0) * Number(li.quantity),
            0
          )
          if (totalCogs > 0) {
            await createJournalEntry(tx, {
              description: `COGS — ${dnNumber}`,
              date: today,
              reference: `DN:${dnId}`,
              createdById: userId,
              lines: [
                { debitAccountId: cogsAcc.id, debitAmount: totalCogs, description: 'Cost of goods sold' },
                { creditAccountId: inventoryAcc.id, creditAmount: totalCogs, description: 'Inventory reduction' },
              ],
            })
          }
        }
      })
    } catch { /* best-effort */ }
  })
}
