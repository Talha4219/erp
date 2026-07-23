import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'
import { withAuth } from '@/lib/api-middleware'

const stepSchema = z.object({
  stepOrder: z.number().int().min(1),
  name: z.string().min(1),
  approverRole: z.string().optional(),
  escalateAfterHours: z.number().optional(),
})

const schema = z.object({
  name: z.string().min(1),
  module: z.string().min(1),
  isActive: z.boolean().default(true),
  steps: z.array(stepSchema).min(1),
})

export const GET = withAuth(async (req: NextRequest, { session }) => {
  void session

  try {
    const defs = await prisma.workflowDefinition.findMany({
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        _count: { select: { instances: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: defs })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  void session

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const def = await prisma.workflowDefinition.create({
      data: {
        name: parsed.data.name,
        module: parsed.data.module,
        isActive: parsed.data.isActive,
        steps: { create: parsed.data.steps },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })
    return NextResponse.json({ success: true, data: def }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
)