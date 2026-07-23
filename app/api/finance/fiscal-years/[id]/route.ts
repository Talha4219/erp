import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

type Params = { params: Promise<{ id: string }> }

export const PATCH = withAuth<Params>(async (req: NextRequest, { params, session }) => {
  const body = await req.json()

  try {
    const year = await prisma.$transaction(async (tx) => {
      if (body.isCurrent) {
        await tx.fiscalYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } })
      }
      if (body.isClosed) {
        await tx.fiscalYear.update({
          where: { id: (await params).id },
          data: { isClosed: true, closedAt: new Date(), closedById: session.user.id! },
        })
      }
      return tx.fiscalYear.update({
        where: { id: (await params).id },
        data: {
          ...(typeof body.isCurrent === 'boolean' ? { isCurrent: body.isCurrent } : {}),
          ...(typeof body.isClosed === 'boolean' && body.isClosed
            ? { isClosed: true, closedAt: new Date(), closedById: session.user.id! }
            : {}),
        },
      })
    })
    return NextResponse.json({ success: true, data: year })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})
