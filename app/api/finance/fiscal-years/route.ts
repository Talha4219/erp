import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'
import { withAuth } from '@/lib/api-middleware'

const schema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean().default(false),
})

export const GET = withAuth(async () => {
  try {
    const years = await prisma.fiscalYear.findMany({
      include: { _count: { select: { periods: true } } },
      orderBy: { startDate: 'desc' },
    })
    return NextResponse.json({ success: true, data: years })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const year = await prisma.$transaction(async (tx) => {
      if (parsed.data.isCurrent) {
        await tx.fiscalYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } })
      }
      return tx.fiscalYear.create({
        data: {
          name: parsed.data.name,
          startDate: new Date(parsed.data.startDate),
          endDate: new Date(parsed.data.endDate),
          isCurrent: parsed.data.isCurrent,
        },
      })
    })
    return NextResponse.json({ success: true, data: year }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})
