import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModuleAccess } from '@/lib/authz'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  try {
    const [totalLeads, leadsByStatus, totalContacts, totalOpps, oppsByStage, pipelineValue, recentActivities, recentLeads] = await Promise.all([
      prisma.crmLead.count({ where: { deletedAt: null } }),
      prisma.crmLead.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
      prisma.crmContact.count({ where: { deletedAt: null } }),
      prisma.crmOpportunity.count({ where: { deletedAt: null } }),
      prisma.crmOpportunity.groupBy({ by: ['stage'], where: { deletedAt: null }, _count: true, _sum: { value: true } }),
      prisma.crmOpportunity.aggregate({ where: { deletedAt: null, stage: { notIn: ['CLOSED_LOST'] } }, _sum: { value: true } }),
      prisma.crmActivity.findMany({ include: { lead: { select: { firstName: true, lastName: true } }, contact: { select: { firstName: true, lastName: true } }, opportunity: { select: { title: true } } }, orderBy: { createdAt: 'desc' }, take: 8 }),
      prisma.crmLead.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ])
    return NextResponse.json({
      success: true,
      data: {
        totalLeads, totalContacts, totalOpps,
        pipelineValue: Number(pipelineValue._sum.value ?? 0),
        leadsByStatus: Object.fromEntries(leadsByStatus.map((r) => [r.status, r._count])),
        oppsByStage: oppsByStage.map((r) => ({ stage: r.stage, count: r._count, value: Number(r._sum.value ?? 0) })),
        recentActivities, recentLeads,
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
