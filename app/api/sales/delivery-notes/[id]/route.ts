import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { eventBus } from '@/lib/events/bus'
import { hasModuleAccess } from '@/lib/authz'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    const dn = await prisma.deliveryNote.findUnique({
      where: { id },
      include: { customer: true, so: { include: { lineItems: true } }, lineItems: true },
    })
    if (!dn) return NextResponse.json(apiError('Not found'), { status: 404 })
    return NextResponse.json(apiResponse(dn))
  } catch {
    return NextResponse.json(apiError('Failed to fetch'), { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const body = await req.json()

    const existing = await prisma.deliveryNote.findUnique({
      where: { id },
      include: { lineItems: true },
    })
    if (!existing) return NextResponse.json(apiError('Not found'), { status: 404 })

    const updated = await prisma.deliveryNote.update({
      where: { id },
      data: body,
      include: { lineItems: true },
    })

    // Fire stock-reduction event when status transitions to DISPATCHED
    if (body.status === 'DISPATCHED' && existing.status !== 'DISPATCHED') {
      // Resolve itemId for each line via soItemId → SalesOrderItem
      const soItemIds = updated.lineItems
        .map((li) => li.soItemId)
        .filter((id): id is string => !!id)

      const soItems = soItemIds.length
        ? await prisma.salesOrderItem.findMany({ where: { id: { in: soItemIds } } })
        : []
      const soItemMap = new Map(soItems.map((si) => [si.id, si.itemId]))

      await eventBus.emit('delivery_note.dispatched', {
        dnId: id,
        dnNumber: updated.dnNumber,
        soId: updated.soId,
        customerId: updated.customerId,
        userId: session?.user?.id ?? 'system',
        lineItems: updated.lineItems.map((li) => ({
          itemId: li.soItemId ? (soItemMap.get(li.soItemId) ?? null) : null,
          description: li.description,
          deliveredQty: Number(li.deliveredQty),
        })),
      })
    }

    return NextResponse.json(apiResponse(updated))
  } catch {
    return NextResponse.json(apiError('Failed to update'), { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (!hasModuleAccess(session, 'sales')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    await prisma.deliveryNote.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json(apiResponse(null))
  } catch {
    return NextResponse.json(apiError('Failed to delete'), { status: 500 })
  }
}
