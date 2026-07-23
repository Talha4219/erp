import { PrismaClient } from '@prisma/client'
import prisma from '@/lib/prisma'

export type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ── Input types ─────────────────────────────────────────────────────────

export interface PosLineInput {
  itemId: string
  description: string
  quantity: number
  unitPriceGbp: number
  lineDiscountGbp: number
  vatRateApplied: number
  net: number
  vat: number
}

export interface PosTotals {
  totalDiscountGbp: number
  netTotalGbp: number
  vatAmountGbp: number
  grandTotalGbp: number
}

export interface CreatePosOrderInput {
  customerId?: string | null
  paymentMethod: string
  stripePaymentIntentId?: string | null
  stripePaymentStatus?: string | null
  computedLines: PosLineInput[]
  totals: PosTotals
  orderDate?: Date
}

export interface StandardLineInput {
  itemId?: string | null
  description: string
  quantity: number
  unitPrice: number
  discount?: number
  taxRate?: number
  totalPrice: number
}

export interface CreateStandardOrderInput {
  soNumber: string
  customerId: string
  companyId?: string | null
  quotationId?: string | null
  orderDate: Date
  deliveryDate?: Date | null
  notes?: string | null
  lineItems: StandardLineInput[]
  subTotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
}

export interface OrderFilters {
  companyId?: string | null
  dateFrom?: Date | null
  dateTo?: Date | null
  channel?: string | null
  limit?: number
}

// ── Repository ──────────────────────────────────────────────────────────

export class SalesRepository {
  constructor(private prisma: PrismaClient) {}

  async createPosOrder(tx: TxClient, input: CreatePosOrderInput) {
    const order = await tx.salesOrderV2.create({
      data: {
        orderNumber: `POS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        channel: 'POS',
        orderType: 'CASH',
        workflowStatus: 'COMPLETED',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'DELIVERED',
        customerId: input.customerId,
        orderDate: input.orderDate ?? new Date(),
        subTotal: input.totals.netTotalGbp,
        taxAmount: input.totals.vatAmountGbp,
        discountAmount: input.totals.totalDiscountGbp,
        totalAmount: input.totals.grandTotalGbp,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        stripePaymentStatus: input.stripePaymentStatus ?? null,
        lineItems: {
          create: input.computedLines.map((l) => ({
            itemId: l.itemId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPriceGbp,
            discount: l.lineDiscountGbp,
            taxRate: l.vatRateApplied,
            totalPrice: l.net + l.vat,
          })),
        },
      },
    })

    return order
  }

  async createStandardOrder(tx: TxClient, input: CreateStandardOrderInput) {
    const oldOrder = await tx.salesOrder.create({
      data: {
        soNumber: input.soNumber,
        customerId: input.customerId,
        companyId: input.companyId ?? undefined,
        quotationId: input.quotationId ?? undefined,
        orderDate: input.orderDate,
        deliveryDate: input.deliveryDate ?? undefined,
        notes: input.notes ?? undefined,
        subTotal: input.subTotal,
        taxAmount: input.taxAmount,
        discountAmount: input.discountAmount,
        totalAmount: input.totalAmount,
        lineItems: {
          create: input.lineItems.map((li) => ({
            itemId: li.itemId ?? undefined,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            discount: li.discount ?? 0,
            taxRate: li.taxRate ?? 0,
            totalPrice: li.totalPrice,
          })),
        },
      },
      include: { lineItems: true },
    })

    await tx.salesOrderV2.create({
      data: {
        orderNumber: input.soNumber,
        channel: 'STANDARD',
        orderType: 'CREDIT',
        workflowStatus: 'DRAFT',
        paymentStatus: 'UNPAID',
        fulfillmentStatus: 'PENDING',
        customerId: input.customerId,
        orderDate: input.orderDate,
        deliveryDate: input.deliveryDate ?? null,
        subTotal: input.subTotal,
        taxAmount: input.taxAmount,
        discountAmount: input.discountAmount,
        totalAmount: input.totalAmount,
        notes: input.notes ?? null,
        legacyStandardId: oldOrder.id,
        lineItems: {
          create: input.lineItems.map((li) => ({
            itemId: li.itemId ?? null,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            discount: li.discount ?? 0,
            taxRate: li.taxRate ?? 0,
            totalPrice: li.totalPrice,
          })),
        },
      },
    })

    return oldOrder
  }


}

export const salesRepository = new SalesRepository(prisma)
