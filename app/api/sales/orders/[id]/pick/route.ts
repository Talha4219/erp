import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

type Params = { params: { id: string } }

export const POST = withAuth<Params>(async (_req: NextRequest, { params }) => {
  try {
    const order = await prisma.salesOrder.findUnique({ where: { id: params.id } })
    if (!order) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    if (order.status !== 'PICKING')
      return NextResponse.json({ success: false, error: 'Order must be in PICKING status' }, { status: 400 })

    const updated = await prisma.salesOrder.update({
      where: { id: params.id },
      data: { status: 'PACKED' },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
