import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { returnRequestSchema } from '@/lib/validations/fulfillment'
import { nextDocNumber } from '@/lib/services/numbering'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { withAuth } from '@/lib/api-middleware'
import { getUserCompanyId, companyScope } from '@/lib/company-scope'
import { eventBus } from '@/lib/events/bus'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id!)
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const skip = (page - 1) * limit
  try {
    const [returns, total] = await Promise.all([
      prisma.returnRequest.findMany({
        where: { deletedAt: null, ...companyScope(companyId) },
        select: {
          id: true, returnNumber: true, fulfillmentId: true, soId: true,
          customerId: true, warehouseId: true, returnDate: true, reason: true,
          resolution: true, totalAmount: true, status: true, notes: true,
          companyId: true, createdAt: true, updatedAt: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          lineItems: { select: { id: true, itemId: true, description: true, quantity: true, unitPrice: true, totalPrice: true, condition: true } },
          fulfillment: { select: { id: true, fulfillmentNumber: true } },
          so: { select: { id: true, soNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.returnRequest.count({ where: { deletedAt: null, ...companyScope(companyId) } }),
    ])
    return NextResponse.json({ success: true, data: returns, meta: { total, page, limit } })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function postHandler(req: NextRequest, { session }: { session: import('@/lib/api-middleware').AuthedSession }) {
  const body = await req.json()
  const parsed = returnRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { fulfillmentId, soId, customerId, warehouseId, returnDate, reason, resolution, notes, lineItems } = parsed.data

  try {
    const returnNumber = await nextDocNumber('return_request')
    const companyId = await getUserCompanyId(session.user.id!)

    const totalAmount = lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0)

    const returnRequest = await prisma.returnRequest.create({
      data: {
        returnNumber,
        fulfillmentId: fulfillmentId ?? undefined,
        soId: soId ?? undefined,
        customerId,
        companyId: companyId ?? undefined,
        warehouseId: warehouseId ?? undefined,
        returnDate: new Date(returnDate),
        reason,
        resolution: resolution ?? undefined,
        totalAmount,
        notes,
        lineItems: {
          create: lineItems.map((li) => ({
            itemId: li.itemId,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            totalPrice: li.unitPrice * li.quantity,
            condition: li.condition,
          })),
        },
      },
      select: {
        id: true, returnNumber: true, customerId: true, status: true,
        returnDate: true, reason: true, totalAmount: true, notes: true, createdAt: true,
        customer: { select: { id: true, name: true, email: true } },
        lineItems: { select: { id: true, description: true, quantity: true, totalPrice: true } },
      },
    })

    eventBus.emit('return.submitted', {
      returnId: returnRequest.id,
      returnNumber: returnRequest.returnNumber,
      customerId: returnRequest.customerId,
      userId: session.user.id!,
    })

    return NextResponse.json({ success: true, data: returnRequest }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const POST = withRateLimit(withAudit(withAuth(postHandler) as Parameters<typeof withAudit>[0], 'ReturnRequest'))
