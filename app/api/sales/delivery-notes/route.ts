import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { nextDocNumber } from '@/lib/services/numbering'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const notes = await prisma.deliveryNote.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { name: true } }, so: { select: { soNumber: true } }, _count: { select: { lineItems: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(apiResponse(notes))
  } catch {
    return NextResponse.json(apiError('Failed to fetch delivery notes'), { status: 500 })
  }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { soId, customerId, deliveryDate, carrier, trackingNumber, notes, lineItems } = body
    if (!soId || !customerId || !deliveryDate) return NextResponse.json(apiError('soId, customerId, deliveryDate required'), { status: 400 })
    const dnNumber = await nextDocNumber('delivery_note')
    const dn = await prisma.deliveryNote.create({
      data: {
        dnNumber, soId, customerId,
        deliveryDate: new Date(deliveryDate),
        carrier, trackingNumber, notes,
        lineItems: lineItems?.length ? { createMany: { data: lineItems } } : undefined,
      },
      include: { lineItems: true },
    })
    return NextResponse.json(apiResponse(dn), { status: 201 })
  } catch {
    return NextResponse.json(apiError('Failed to create delivery note'), { status: 500 })
  }
})
