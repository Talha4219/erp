import prisma from '@/lib/prisma'
import { createNotification } from '@/lib/services/notification'

export function listDefinitions() {
  return prisma.workflowDefinition.findMany({
    include: { steps: { orderBy: { stepOrder: 'asc' } }, _count: { select: { instances: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createDefinition(data: { name: string; module: string; isActive?: boolean; steps: { stepOrder: number; name: string; approverRole?: string; escalateAfterHours?: number }[] }) {
  return prisma.workflowDefinition.create({
    data: { name: data.name, module: data.module, isActive: data.isActive ?? true, steps: { create: data.steps } },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  })
}

export function listInstances(status?: string, entityType?: string | null) {
  return prisma.workflowInstance.findMany({
    where: { status: (status ?? 'PENDING') as any, ...(entityType ? { entityType } : {}) },
    include: { definition: { select: { name: true, module: true } }, requester: { select: { name: true, email: true } }, actions: { orderBy: { actedAt: 'desc' }, take: 1 } },
    orderBy: { requestedAt: 'desc' },
  })
}

export async function createInstance(data: { definitionId: string; entityType: string; entityId: string }, requestedById: string) {
  const definition = await prisma.workflowDefinition.findUnique({ where: { id: data.definitionId } })
  if (!definition) throw new Error('Workflow definition not found')

  return prisma.workflowInstance.create({
    data: { definitionId: data.definitionId, entityType: data.entityType, entityId: data.entityId, requestedById, status: 'PENDING' },
    include: { definition: true },
  })
}

export async function actOnInstance(instanceId: string, action: string, comments: string | undefined, actorId: string) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: { definition: true },
  })
  if (!instance) throw new Error('Not found')
  if (instance.status !== 'PENDING' && instance.status !== 'IN_PROGRESS') throw new Error('Workflow already completed')

  const newStatus = action === 'APPROVED' ? 'APPROVED' : action === 'REJECTED' ? 'REJECTED' : 'ESCALATED'

  const [updated] = await prisma.$transaction([
    prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status: newStatus as any, completedAt: action !== 'ESCALATED' ? new Date() : undefined, rejectedAt: action === 'REJECTED' ? new Date() : undefined, rejectionReason: action === 'REJECTED' ? comments : undefined },
    }),
    prisma.workflowAction.create({ data: { instanceId, step: instance.currentStep, action, actorId, comments } }),
  ])

  await createNotification({
    userId: instance.requestedById,
    title: `${instance.definition.name} ${action.toLowerCase()}`,
    body: comments ?? `Your ${instance.definition.module} request has been ${action.toLowerCase()}.`,
    type: action === 'APPROVED' ? 'SUCCESS' : action === 'REJECTED' ? 'ERROR' : 'WARNING',
    entityType: instance.entityType,
    entityId: instance.entityId,
  })

  return updated
}

export function listDelegations(userId: string) {
  return prisma.approvalDelegation.findMany({
    where: { OR: [{ delegatorId: userId }, { delegateeId: userId }] },
    include: { delegator: { select: { id: true, name: true, email: true } }, delegatee: { select: { id: true, name: true, email: true } } },
    orderBy: { startDate: 'desc' },
  })
}

export async function createDelegation(data: { delegateeId: string; module?: string; startDate: string; endDate: string; reason?: string }, delegatorId: string) {
  const start = new Date(data.startDate)
  const end = new Date(data.endDate)
  if (end <= start) throw new Error('endDate must be after startDate')
  if (data.delegateeId === delegatorId) throw new Error('Cannot delegate to yourself')

  return prisma.approvalDelegation.create({
    data: { delegatorId, delegateeId: data.delegateeId, module: data.module, startDate: start, endDate: end, reason: data.reason },
    include: { delegator: { select: { id: true, name: true, email: true } }, delegatee: { select: { id: true, name: true, email: true } } },
  })
}

export async function cancelDelegation(id: string, userId: string) {
  const delegation = await prisma.approvalDelegation.findUnique({ where: { id } })
  if (!delegation) throw new Error('Not found')
  if (delegation.delegatorId !== userId) throw new Error('Forbidden')

  return prisma.approvalDelegation.update({ where: { id }, data: { isActive: false } })
}
