/**
 * Approval delegation management.
 * GET  /api/workflow/delegate          — list my active delegations (as delegator)
 * POST /api/workflow/delegate          — create delegation
 * DELETE /api/workflow/delegate/[id]   — cancel delegation
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'

const schema = z.object({
  delegateeId: z.string(),
  module: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const delegations = await prisma.approvalDelegation.findMany({
    where: {
      OR: [
        { delegatorId: session.user.id },
        { delegateeId: session.user.id },
      ],
    },
    include: {
      delegator: { select: { id: true, name: true, email: true } },
      delegatee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { startDate: 'desc' },
  })
  return NextResponse.json({ success: true, data: delegations })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { delegateeId, module, startDate, endDate, reason } = parsed.data

  if (delegateeId === session.user.id) {
    return NextResponse.json({ success: false, error: 'Cannot delegate to yourself' }, { status: 400 })
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end <= start) {
    return NextResponse.json({ success: false, error: 'endDate must be after startDate' }, { status: 400 })
  }

  try {
    const delegation = await prisma.approvalDelegation.create({
      data: {
        delegatorId: session.user.id!,
        delegateeId,
        module,
        startDate: start,
        endDate: end,
        reason,
      },
      include: {
        delegator: { select: { id: true, name: true, email: true } },
        delegatee: { select: { id: true, name: true, email: true } },
      },
    })
    return NextResponse.json({ success: true, data: delegation }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
