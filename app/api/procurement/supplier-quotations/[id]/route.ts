import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { nextPurchaseOrderNumber } from '@/lib/codes'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

export const GET = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    const sq = await prisma.supplierQuotation.findUnique({ where: { id }, include: { vendor: true, rfq: { include: { lineItems: true } }, lineItems: true, purchaseOrder: { select: { id: true, poNumber: true, status: true } } } })
    if (!sq) return NextResponse.json(apiError('Not found'), { status: 404 })
    return NextResponse.json(apiResponse(sq))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const PATCH = withAuth(async (req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    const body = await req.json()
    if (body.action === 'create-po') {
      const sq = await prisma.supplierQuotation.findUnique({ where: { id }, include: { lineItems: true, purchaseOrder: { select: { id: true } } } })
      if (!sq) return NextResponse.json(apiError('Not found'), { status: 404 })
      if (sq.purchaseOrder) return NextResponse.json(apiError('PO already exists'), { status: 400 })
      const poNumber = await nextPurchaseOrderNumber()
      const po = await prisma.$transaction(async (tx) => {
        const newPO = await tx.purchaseOrder.create({
          data: { poNumber, sqId: id, vendorId: sq.vendorId, orderDate: new Date(), totalAmount: Number(sq.totalAmount), taxAmount: 0, shippingCost: 0, grandTotal: Number(sq.totalAmount),
            lineItems: sq.lineItems.length ? { createMany: { data: sq.lineItems.map((i) => ({ description: i.description, quantity: i.quantity, uom: i.uom, unitPrice: i.unitPrice, taxRate: i.taxRate, totalPrice: i.totalPrice })) } } : undefined },
        })
        await tx.supplierQuotation.update({ where: { id }, data: { status: 'ACCEPTED' } })
        return newPO
      })
      return NextResponse.json(apiResponse(po))
    }
    const updated = await prisma.supplierQuotation.update({ where: { id }, data: body })
    return NextResponse.json(apiResponse(updated))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
