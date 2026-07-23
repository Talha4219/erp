import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { nextPurchaseRequestNumber } from '@/lib/codes'
import { eventBus } from '@/lib/events/bus'
import { withAuth } from '@/lib/api-middleware'

export async function GET() {
  try {
    const prs = await prisma.purchaseRequisition.findMany({
      where: { deletedAt: null },
      include: { vendor: { select: { name: true } }, lineItems: true, _count: { select: { rfqs: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(apiResponse(prs))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
}

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { requestedById, vendorId, department, requiredDate, notes, priority = 'MEDIUM', lineItems = [], submitForApproval = false } = body
    if (!requestedById || !requiredDate) return NextResponse.json(apiError('requestedById, requiredDate required'), { status: 400 })
    const prNumber = await nextPurchaseRequestNumber()
    type LI = { estimatedUnitPrice: number; quantity: number; [k: string]: unknown }
    const totalAmount = (lineItems as LI[]).reduce((s, i) => s + Number(i.estimatedUnitPrice) * Number(i.quantity), 0)
    const status = submitForApproval ? 'PENDING' : 'DRAFT'
    const pr = await prisma.purchaseRequisition.create({
      data: {
        prNumber, requestedById, vendorId, department,
        requiredDate: new Date(requiredDate), notes, priority,
        status,
        totalAmount,
        lineItems: lineItems.length ? { createMany: { data: (lineItems as LI[]).map(i => ({ description: String(i.description ?? ''), uom: String(i.uom ?? 'EA'), quantity: Number(i.quantity), estimatedUnitPrice: Number(i.estimatedUnitPrice), totalPrice: Number(i.estimatedUnitPrice) * Number(i.quantity) })) } } : undefined,
      },
      include: { lineItems: true },
    })

    // If submitting directly, fire the event immediately
    if (submitForApproval) {
      eventBus.emit('pr.submitted', {
        prId: pr.id,
        prNumber: pr.prNumber,
        requestedById: pr.requestedById,
        department: pr.department,
        totalAmount,
      }).catch(() => {})
    }

    return NextResponse.json(apiResponse(pr), { status: 201 })
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
