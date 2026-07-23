import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { nextCreditNoteNumber } from '@/lib/codes'
import { withAuth, AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

export const GET = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    const ret = await prisma.salesReturn.findUnique({
      where: { id },
      include: { customer: true, invoice: true, lineItems: true, creditNote: true },
    })
    if (!ret) return NextResponse.json(apiError('Not found'), { status: 404 })
    return NextResponse.json(apiResponse(ret))
  } catch {
    return NextResponse.json(apiError('Failed to fetch'), { status: 500 })
  }
})

export const PATCH = withAuth(async (req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    const body = await req.json()

    if (body.action === 'issue-credit-note') {
      const ret = await prisma.salesReturn.findUnique({ where: { id }, include: { creditNote: true, lineItems: true } })
      if (!ret) return NextResponse.json(apiError('Not found'), { status: 404 })
      if (ret.creditNote) return NextResponse.json(apiError('Credit note already issued'), { status: 400 })
      const creditNoteNumber = await nextCreditNoteNumber()
      const today = new Date()
      const wasCompleted = ret.status === 'COMPLETED'
      const cn = await prisma.$transaction(async (tx) => {
        const note = await tx.creditNote.create({
          data: { creditNoteNumber, customerId: ret.customerId, returnId: id, invoiceId: ret.invoiceId, issueDate: new Date(), amount: ret.totalAmount, status: 'ISSUED', reason: ret.reason },
        })
        await tx.salesReturn.update({ where: { id }, data: { status: 'COMPLETED' } })

        // Restock inventory the first time this return is marked COMPLETED
        if (!wasCompleted) {
          const restockLines = ret.lineItems.filter((li): li is typeof li & { itemId: string; warehouseId: string } => !!li.itemId && !!li.warehouseId && Number(li.quantity) > 0)
          for (const li of restockLines) {
            await tx.warehouseStock.upsert({
              where: { warehouseId_itemId: { warehouseId: li.warehouseId, itemId: li.itemId } },
              update: { quantity: { increment: li.quantity } },
              create: { warehouseId: li.warehouseId, itemId: li.itemId, quantity: li.quantity, avgCost: li.unitPrice },
            })
          }
          await tx.stockLedger.createMany({
            data: restockLines.map(li => ({
              itemId: li.itemId,
              warehouseId: li.warehouseId,
              transactionType: 'IN',
              quantity: li.quantity,
              unitCost: li.unitPrice,
              totalCost: Number(li.quantity) * Number(li.unitPrice),
              referenceType: 'SALES_RETURN',
              referenceId: id,
              notes: `Sales return ${ret.returnNumber}`,
              transactionDate: today,
            })),
          })
        }
        return note
      })
      return NextResponse.json(apiResponse(cn))
    }

    const current = await prisma.salesReturn.findUnique({ where: { id }, include: { lineItems: true } })
    if (!current) return NextResponse.json(apiError('Not found'), { status: 404 })

    const allowed: Record<string, unknown> = {}
    if (body.status !== undefined) allowed.status = body.status
    if (body.notes !== undefined) allowed.notes = body.notes
    const updated = await prisma.salesReturn.update({ where: { id }, data: allowed })

    // Restock inventory the first time this return is marked COMPLETED
    if (body.status === 'COMPLETED' && current.status !== 'COMPLETED') {
      const today = new Date()
      await prisma.$transaction(async (tx) => {
        const restockLines2 = current.lineItems.filter((li): li is typeof li & { itemId: string; warehouseId: string } => !!li.itemId && !!li.warehouseId && Number(li.quantity) > 0)
        for (const li of restockLines2) {
          await tx.warehouseStock.upsert({
            where: { warehouseId_itemId: { warehouseId: li.warehouseId, itemId: li.itemId } },
            update: { quantity: { increment: li.quantity } },
            create: { warehouseId: li.warehouseId, itemId: li.itemId, quantity: li.quantity, avgCost: li.unitPrice },
          })
        }
        await tx.stockLedger.createMany({
          data: restockLines2.map(li => ({
            itemId: li.itemId,
            warehouseId: li.warehouseId,
            transactionType: 'IN',
            quantity: li.quantity,
            unitCost: li.unitPrice,
            totalCost: Number(li.quantity) * Number(li.unitPrice),
            referenceType: 'SALES_RETURN',
            referenceId: id,
            notes: `Sales return ${current.returnNumber}`,
            transactionDate: today,
          })),
        })
      })
    }

    return NextResponse.json(apiResponse(updated))
  } catch {
    return NextResponse.json(apiError('Failed to update'), { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    await prisma.salesReturn.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json(apiResponse(null))
  } catch {
    return NextResponse.json(apiError('Failed to delete'), { status: 500 })
  }
})
