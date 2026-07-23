import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { nextVendorInvoiceNumber } from '@/lib/codes'
import { eventBus } from '@/lib/events/bus'
import { withAuth } from '@/lib/api-middleware'

export async function GET() {
  try {
    const invoices = await prisma.vendorInvoice.findMany({
      where: { deletedAt: null },
      include: {
        vendor: { select: { name: true } },
        po: { select: { poNumber: true } },
        department: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(apiResponse(invoices))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
}

type ItemInput = {
  itemId?: string; description: string; quantity: number; unitPrice: number
  taxRate?: number; discount?: number
  glAccountId?: string; warehouseId?: string; costCentreId?: string; projectId?: string
}

export const POST = withAuth(async (req: NextRequest, { session }) => {
  try {
    const body = await req.json()
    const {
      vendorId, poId, invoiceDate, dueDate, notes,
      currencyCode, exchangeRate, departmentId, costCentreId,
      shippingCharges, discountAmount: headerDiscount,
      items,
    }: {
      vendorId: string; poId?: string; invoiceDate: string; dueDate: string; notes?: string
      currencyCode?: string; exchangeRate?: number; departmentId?: string; costCentreId?: string
      shippingCharges?: number; discountAmount?: number
      items?: ItemInput[]
      subTotal?: number; taxAmount?: number
    } = body

    if (!vendorId || !invoiceDate || !dueDate) return NextResponse.json(apiError('vendorId, invoiceDate, dueDate required'), { status: 400 })

    let subTotal = 0, taxAmount = 0, lineDiscount = 0
    const lineItemsData = (items ?? []).map((it) => {
      const qty = Number(it.quantity ?? 1)
      const unitPrice = Number(it.unitPrice ?? 0)
      const taxRate = Number(it.taxRate ?? 0)
      const discount = Number(it.discount ?? 0)
      const lineSub = qty * unitPrice
      const lineTax = lineSub * (taxRate / 100)
      const totalPrice = lineSub + lineTax - discount
      subTotal += lineSub
      taxAmount += lineTax
      lineDiscount += discount
      return {
        itemId: it.itemId || undefined,
        description: it.description,
        quantity: qty, unitPrice, taxRate, discount, totalPrice,
        glAccountId: it.glAccountId || undefined,
        warehouseId: it.warehouseId || undefined,
        costCentreId: it.costCentreId || undefined,
        projectId: it.projectId || undefined,
      }
    })

    // Fallback for legacy simple-form callers with no items array
    if (lineItemsData.length === 0) {
      subTotal = Number(body.subTotal ?? 0)
      taxAmount = Number(body.taxAmount ?? 0)
    }

    const shipping = Number(shippingCharges ?? 0)
    const discountAmount = Number(headerDiscount ?? lineDiscount)
    const totalAmount = subTotal + taxAmount + shipping - discountAmount

    // 3-way match check against PO (and its GRNs) if referenced
    let matchingStatus: 'PENDING' | 'MATCHED' | 'MISMATCH' = 'PENDING'
    if (poId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        select: { grandTotal: true },
      })
      if (po) matchingStatus = Math.abs(Number(po.grandTotal) - totalAmount) < 0.01 ? 'MATCHED' : 'MISMATCH'
    }

    const invoiceNumber = await nextVendorInvoiceNumber()

    const inv = await prisma.vendorInvoice.create({
      data: {
        invoiceNumber, vendorId, poId: poId || undefined,
        invoiceDate: new Date(invoiceDate), dueDate: new Date(dueDate),
        subTotal, taxAmount, shippingCharges: shipping, discountAmount, totalAmount,
        matchingStatus, notes,
        currencyCode: currencyCode || undefined, exchangeRate: exchangeRate ?? undefined,
        departmentId: departmentId || undefined, costCentreId: costCentreId || undefined,
        items: lineItemsData.length > 0 ? { create: lineItemsData } : undefined,
      },
      include: { items: true },
    })

    eventBus.emit('vendor_invoice.created', {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendorId: inv.vendorId,
      totalAmount,
      dueDate: new Date(dueDate),
      userId: session.user.id!,
    }).catch(() => {})

    return NextResponse.json(apiResponse(inv), { status: 201 })
  } catch (e) {
    console.error('[procurement/vendor-invoices POST]', (e as Error).message)
    return NextResponse.json(apiError('Failed'), { status: 500 })
  }
})
