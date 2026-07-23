import prisma from '@/lib/prisma'

// ── Leads ────────────────────────────────────────────────────────────────

export function listLeads() {
  return prisma.crmLead.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true, company: true, email: true, phone: true, source: true, status: true, notes: true, createdAt: true, campaign: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export function getLead(id: string) {
  return prisma.crmLead.findUnique({
    where: { id },
    include: { campaign: true, activities: { orderBy: { createdAt: 'desc' } }, opportunity: true },
  })
}

export async function createLead(data: Record<string, unknown>) {
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'company', 'jobTitle', 'source', 'status', 'rating', 'notes', 'campaignId', 'assignedTo']
  const createData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) createData[key] = data[key]
  }
  return prisma.crmLead.create({ data: createData as any })
}

export async function updateLead(id: string, data: Record<string, unknown>) {
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'company', 'jobTitle', 'source', 'status', 'rating', 'notes', 'campaignId', 'assignedTo']
  const updateData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = data[key]
  }
  return prisma.crmLead.update({ where: { id }, data: updateData as any })
}

export function softDeleteLead(id: string) {
  return prisma.crmLead.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Contacts ─────────────────────────────────────────────────────────────

export function listContacts() {
  return prisma.crmContact.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, jobTitle: true, createdAt: true, customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export function getContact(id: string) {
  return prisma.crmContact.findUnique({
    where: { id },
    include: { customer: true, activities: { orderBy: { createdAt: 'desc' } }, opportunities: true },
  })
}

export async function createContact(data: Record<string, unknown>) {
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'mobile', 'jobTitle', 'department', 'customerId', 'notes', 'isActive']
  const createData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) createData[key] = data[key]
  }
  return prisma.crmContact.create({ data: createData as any })
}

export async function updateContact(id: string, data: Record<string, unknown>) {
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'mobile', 'jobTitle', 'department', 'customerId', 'notes', 'isActive']
  const updateData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = data[key]
  }
  return prisma.crmContact.update({ where: { id }, data: updateData as any })
}

export function softDeleteContact(id: string) {
  return prisma.crmContact.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Opportunities ────────────────────────────────────────────────────────

export function listOpportunities() {
  return prisma.crmOpportunity.findMany({
    where: { deletedAt: null },
    include: { contact: { select: { id: true, firstName: true, lastName: true } }, customer: { select: { id: true, name: true } }, lead: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export function getOpportunity(id: string) {
  return prisma.crmOpportunity.findUnique({
    where: { id },
    include: { lead: true, contact: true, customer: true, activities: { orderBy: { createdAt: 'desc' } } },
  })
}

export async function createOpportunity(data: Record<string, unknown>) {
  const allowed = ['title', 'leadId', 'contactId', 'customerId', 'stage', 'probability', 'value', 'assignedTo', 'notes']
  const createData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) createData[key] = data[key]
  }
  if (data.expectedClose) createData.expectedClose = new Date(data.expectedClose as string)
  return prisma.crmOpportunity.create({ data: createData as any })
}

export async function updateOpportunity(id: string, data: Record<string, unknown>) {
  const allowed = ['title', 'leadId', 'contactId', 'customerId', 'stage', 'assignedTo', 'notes']
  const updateData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = data[key]
  }
  if (data.expectedClose !== undefined) updateData.expectedClose = data.expectedClose ? new Date(data.expectedClose as string) : null
  if (data.value !== undefined) updateData.value = Number(data.value)
  if (data.probability !== undefined) updateData.probability = Number(data.probability)
  return prisma.crmOpportunity.update({ where: { id }, data: updateData as any })
}

export function softDeleteOpportunity(id: string) {
  return prisma.crmOpportunity.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Campaigns ────────────────────────────────────────────────────────────

export function listCampaigns() {
  return prisma.crmCampaign.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { leads: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function createCampaign(data: Record<string, unknown>) {
  const allowed = ['name', 'type', 'status', 'description', 'targetAudience']
  const createData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) createData[key] = data[key]
  }
  if (data.startDate) createData.startDate = new Date(data.startDate as string)
  if (data.endDate) createData.endDate = new Date(data.endDate as string)
  if (data.budget !== undefined) createData.budget = Number(data.budget)
  return prisma.crmCampaign.create({ data: createData as any })
}

export async function updateCampaign(id: string, data: Record<string, unknown>) {
  const allowed = ['name', 'type', 'status', 'description', 'targetAudience']
  const updateData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = data[key]
  }
  if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate as string) : null
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate as string) : null
  if (data.budget !== undefined) updateData.budget = data.budget !== null ? Number(data.budget) : null
  return prisma.crmCampaign.update({ where: { id }, data: updateData as any })
}

export function softDeleteCampaign(id: string) {
  return prisma.crmCampaign.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ── Activities ───────────────────────────────────────────────────────────

export function listActivities(params: { leadId?: string; contactId?: string; opportunityId?: string }) {
  const where: Record<string, unknown> = {}
  if (params.leadId) where.leadId = params.leadId
  if (params.contactId) where.contactId = params.contactId
  if (params.opportunityId) where.opportunityId = params.opportunityId
  return prisma.crmActivity.findMany({
    where,
    include: { lead: { select: { id: true, firstName: true, lastName: true } }, contact: { select: { id: true, firstName: true, lastName: true } }, opportunity: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export function createActivity(data: Record<string, unknown>) {
  const allowed = ['type', 'subject', 'description', 'dueDate', 'completedAt', 'leadId', 'contactId', 'opportunityId']
  const createData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) createData[key] = data[key]
  }
  if (data.dueDate) createData.dueDate = new Date(data.dueDate as string)
  if (data.completedAt) createData.completedAt = new Date(data.completedAt as string)
  return prisma.crmActivity.create({ data: createData as any })
}

export function updateActivity(id: string, data: Record<string, unknown>) {
  const allowed = ['type', 'subject', 'description', 'dueDate', 'completedAt', 'leadId', 'contactId', 'opportunityId']
  const updateData: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = data[key]
  }
  if (data.dueDate) updateData.dueDate = new Date(data.dueDate as string)
  if (data.completedAt) updateData.completedAt = new Date(data.completedAt as string)
  return prisma.crmActivity.update({ where: { id }, data: updateData as any })
}

export function deleteActivity(id: string) {
  return prisma.crmActivity.delete({ where: { id } })
}

// ── Dashboard ────────────────────────────────────────────────────────────

export async function getCrmDashboard() {
  const [totalLeads, leadsByStatus, totalContacts, totalOpps, oppsByStage, pipelineValue, recentActivities, recentLeads] = await Promise.all([
    prisma.crmLead.count({ where: { deletedAt: null } }),
    prisma.crmLead.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
    prisma.crmContact.count({ where: { deletedAt: null } }),
    prisma.crmOpportunity.count({ where: { deletedAt: null } }),
    prisma.crmOpportunity.groupBy({ by: ['stage'], where: { deletedAt: null }, _count: true, _sum: { value: true } }),
    prisma.crmOpportunity.aggregate({ where: { deletedAt: null, stage: { notIn: ['CLOSED_LOST'] } }, _sum: { value: true } }),
    prisma.crmActivity.findMany({ include: { lead: { select: { id: true, firstName: true, lastName: true } }, contact: { select: { id: true, firstName: true, lastName: true } }, opportunity: { select: { id: true, title: true } } }, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.crmLead.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5 }),
  ])
  return { totalLeads, leadsByStatus, totalContacts, totalOpps, oppsByStage, pipelineValue, recentActivities, recentLeads }
}
