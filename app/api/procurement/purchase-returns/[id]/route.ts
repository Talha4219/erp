import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

export const GET = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    const ret = await prisma.purchaseReturn.findUnique({ where: { id }, include: { vendor: true, grn: true, invoice: true, lineItems: true } })
    if (!ret) return NextResponse.json(apiError('Not found'), { status: 404 })
    return NextResponse.json(apiResponse(ret))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const PATCH = withAuth(async (req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    const body = await req.json()

    const current = await prisma.purchaseReturn.findUnique({ where: { id }, include: { lineItems: true } })
    if (!current) return NextResponse.json(apiError('Not found'), { status: 404 })

    const updated = await prisma.purchaseReturn.update({ where: { id }, data: body })

    // Deduct inventory the first time this return is marked SHIPPED (goods physically leave the warehouse)
    if (body.status === 'SHIPPED' && current.status !== 'SHIPPED') {
      const today = new Date()
      await prisma.$transaction(async (tx) => {
        const shipLines = current.lineItems.filter((li): li is typeof li & { itemId: string; warehouseId: string } => !!li.itemId && !!li.warehouseId && Number(li.quantity) > 0)
        for (const li of shipLines) {
          await tx.warehouseStock.updateMany({
            where: { warehouseId: li.warehouseId, itemId: li.itemId },
            data: { quantity: { decrement: li.quantity } },
          })
        }
        await tx.stockLedger.createMany({
          data: shipLines.map(li => ({
            itemId: li.itemId,
            warehouseId: li.warehouseId,
            transactionType: 'OUT',
            quantity: li.quantity,
            unitCost: li.unitPrice,
            totalCost: Number(li.quantity) * Number(li.unitPrice),
            referenceType: 'PURCHASE_RETURN',
            referenceId: id,
            notes: `Purchase return ${current.returnNumber}`,
            transactionDate: today,
          })),
        })
      })
    }

    return NextResponse.json(apiResponse(updated))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const DELETE = withAuth(async (_req: Request, { params, session }: { params: Promise<{ id: string }> } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    await prisma.purchaseReturn.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json(apiResponse(null))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
