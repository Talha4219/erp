import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { apiError } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(apiError('Unauthorized'), { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'PENDING'
  const entityType = searchParams.get('entityType')

  const instances = await prisma.workflowInstance.findMany({
    where: {
      status: status as never,
      ...(entityType ? { entityType } : {}),
    },
    include: {
      definition: { select: { name: true, module: true } },
      requester: { select: { name: true, email: true } },
      actions: { orderBy: { actedAt: 'desc' }, take: 1 },
    },
    orderBy: { requestedAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: instances })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(apiError('Unauthorized'), { status: 401 })

  const body = await req.json()
  const { definitionId, entityType, entityId } = body

  if (!definitionId || !entityType || !entityId) {
    return NextResponse.json(apiError('definitionId, entityType, and entityId required'), { status: 400 })
  }

  const definition = await prisma.workflowDefinition.findUnique({ where: { id: definitionId } })
  if (!definition) return NextResponse.json(apiError('Workflow definition not found'), { status: 404 })

  const instance = await prisma.workflowInstance.create({
    data: {
      definitionId,
      entityType,
      entityId,
      requestedById: session.user.id,
      status: 'PENDING',
    },
    include: { definition: true },
  })

  return NextResponse.json({ success: true, data: instance }, { status: 201 })
}
