import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const [pendingPRs, pendingPOs, historyPRs, historyPOs] = await Promise.all([
      prisma.purchaseRequisition.findMany({
        where: { deletedAt: null, status: 'PENDING' },
        include: { lineItems: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.purchaseOrder.findMany({
        where: { deletedAt: null, status: 'PENDING_APPROVAL' },
        include: { vendor: { select: { name: true } }, lineItems: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.purchaseRequisition.findMany({
        where: { deletedAt: null, status: { in: ['APPROVED', 'REJECTED'] } },
        include: { lineItems: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      prisma.purchaseOrder.findMany({
        where: { deletedAt: null, status: { in: ['APPROVED', 'CANCELLED'] } },
        include: { vendor: { select: { name: true } }, lineItems: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ])

    return NextResponse.json(apiResponse({
      pending: { prs: pendingPRs, pos: pendingPOs },
      history: { prs: historyPRs, pos: historyPOs },
    }))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
