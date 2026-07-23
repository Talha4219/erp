import prisma from '@/lib/prisma'

export function listProjects() {
  return prisma.project.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { tasks: true } } },
    orderBy: { startDate: 'desc' },
  })
}

export function getProject(id: string) {
  return prisma.project.findUnique({ where: { id }, include: { tasks: true } })
}

export async function createProject(data: Record<string, unknown>) {
  const allowed = ['code', 'name', 'description', 'status', 'budget', 'managerId']
  const createData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) createData[key] = data[key]
  }
  if (data.startDate) createData.startDate = new Date(data.startDate as string)
  if (data.endDate) createData.endDate = data.endDate ? new Date(data.endDate as string) : undefined
  return prisma.project.create({ data: createData as any })
}

export async function updateProject(id: string, data: Record<string, unknown>) {
  const allowed = ['code', 'name', 'description', 'status', 'budget', 'managerId', 'actualCost', 'progress']
  const updateData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = data[key]
  }
  if (data.startDate) updateData.startDate = new Date(data.startDate as string)
  if (data.endDate) updateData.endDate = data.endDate ? new Date(data.endDate as string) : undefined
  return prisma.project.update({ where: { id }, data: updateData as any })
}

export function softDeleteProject(id: string) {
  return prisma.project.update({ where: { id }, data: { status: 'CANCELLED', deletedAt: new Date() } })
}

export function listTasks(projectId: string) {
  return prisma.projectTask.findMany({
    where: { projectId },
    include: { assignee: { select: { name: true, email: true } } },
    orderBy: { startDate: 'asc' },
  })
}

export async function createTask(data: Record<string, unknown>) {
  const allowed = ['projectId', 'milestoneId', 'title', 'description', 'status', 'priority', 'assigneeId', 'estimatedHours', 'actualHours', 'budget', 'actualCost']
  const createData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) createData[key] = data[key]
  }
  if (data.startDate) createData.startDate = new Date(data.startDate as string)
  if (data.dueDate) createData.dueDate = new Date(data.dueDate as string)
  return prisma.projectTask.create({ data: createData as any })
}
