import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { grnSchema } from '@/lib/validations/retail'

export const POST = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: import('@/lib/api-middleware').AuthedSession }) => {
  const id = parseInt(params.id)
  const body = await req.json()
  const parsed = grnSchema.safeParse({ ...body, poId: id })
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const po = await prisma.retailPurchaseOrder.findUnique({
      where: { id },
      include: { lineItems: true },
    })
    if (!po) return NextResponse.json({ success: false, error: 'PO not found' }, { status: 404 })

    const grn = await prisma.goodsReceivedNote.create({
      data: { poId: id, receivedBy: parsed.data.receivedBy, notes: parsed.data.notes },
    })

    await prisma.$transaction(async (tx) => {
      const batchData: Array<{
        itemId: string; batchNumber: string; quantityOnHand: number; supplierId: string
      }> = []

      for (const li of parsed.data.lineItems) {
        const poLine = po.lineItems.find((l) => l.id === li.lineItemId)
        if (!poLine) continue

        const newReceived = poLine.quantityReceived + li.quantityReceived
        await tx.retailPoLineItem.update({
          where: { id: li.lineItemId },
          data: { quantityReceived: newReceived },
        })

        if (li.quantityReceived > 0) {
          batchData.push({
            itemId: String(poLine.productId),
            batchNumber: `GRN-${grn.id}-${li.lineItemId}`,
            quantityOnHand: li.quantityReceived,
            supplierId: String(po.supplierId),
          })
        }
      }

      if (batchData.length > 0) {
        for (let i = 0; i < batchData.length; i += 100) {
          await tx.inventoryBatch.createMany({ data: batchData.slice(i, i + 100) })
        }
      }
    })

    const updatedPo = await prisma.retailPurchaseOrder.findUnique({
      where: { id },
      include: { lineItems: true },
    })
    const allReceived = updatedPo!.lineItems.every((l) => l.quantityReceived >= l.quantityOrdered)
    const anyReceived = updatedPo!.lineItems.some((l) => l.quantityReceived > 0)

    await prisma.retailPurchaseOrder.update({
      where: { id },
      data: { status: allReceived ? 'Received' : anyReceived ? 'Partially Received' : po.status },
    })

    await prisma.auditLog.create({
      data: {
        userId: (session.user as { id: string }).id,
        action: 'GRN_RECEIVED',
        entity: 'RetailPurchaseOrder',
        entityId: String(id),
        newValues: { grnId: grn.id, receivedBy: parsed.data.receivedBy },
      },
    })

    return NextResponse.json({ success: true, data: grn }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
