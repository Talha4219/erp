import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/authz'
import prisma from '@/lib/prisma'
import { apiError } from '@/lib/utils'
import { createNotification } from '@/lib/services/notification'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(apiError('Unauthorized'), { status: 401 })
  if (!hasModuleAccess(session, 'workflow')) return NextResponse.json(apiError('Forbidden'), { status: 403 })

  const body = await req.json()
  const { action, comments } = body // action: APPROVED | REJECTED | ESCALATED

  if (!['APPROVED', 'REJECTED', 'ESCALATED'].includes(action)) {
    return NextResponse.json(apiError('Invalid action'), { status: 400 })
  }

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: params.id },
    include: { definition: true },
  })
  if (!instance) return NextResponse.json(apiError('Not found'), { status: 404 })
  if (instance.status !== 'PENDING' && instance.status !== 'IN_PROGRESS') {
    return NextResponse.json(apiError('Workflow already completed'), { status: 400 })
  }

  const newStatus = action === 'APPROVED' ? 'APPROVED' : action === 'REJECTED' ? 'REJECTED' : 'ESCALATED'

  const [updated] = await prisma.$transaction([
    prisma.workflowInstance.update({
      where: { id: params.id },
      data: {
        status: newStatus as never,
        completedAt: action !== 'ESCALATED' ? new Date() : undefined,
        rejectedAt: action === 'REJECTED' ? new Date() : undefined,
        rejectionReason: action === 'REJECTED' ? comments : undefined,
      },
    }),
    prisma.workflowAction.create({
      data: {
        instanceId: params.id,
        step: instance.currentStep,
        action,
        actorId: session.user.id,
        comments,
      },
    }),
  ])

  // Notify requester
  await createNotification({
    userId: instance.requestedById,
    title: `${instance.definition.name} ${action.toLowerCase()}`,
    body: comments ?? `Your ${instance.definition.module} request has been ${action.toLowerCase()}.`,
    type: action === 'APPROVED' ? 'SUCCESS' : action === 'REJECTED' ? 'ERROR' : 'WARNING',
    entityType: instance.entityType,
    entityId: instance.entityId,
  })

  return NextResponse.json({ success: true, data: updated })
}
