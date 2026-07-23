import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { apiError, apiErrorSafe } from '@/lib/utils'
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(2),
  departmentId: z.string(),
  description: z.string().min(10),
  requirements: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  location: z.string().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).default('FULL_TIME'),
  openings: z.number().int().min(1).default(1),
  status: z.enum(['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'CANCELLED']).default('DRAFT'),
  closingDate: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(apiError('Unauthorized'), { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const jobs = await prisma.jobPosting.findMany({
    where: status ? { status: status as never } : {},
    include: {
      department: { select: { name: true } },
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ success: true, data: jobs })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(apiError('Unauthorized'), { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json(apiErrorSafe(parsed.error, 'Validation failed'), { status: 400 })

  const { closingDate, salaryMin, salaryMax, ...rest } = parsed.data
  const job = await prisma.jobPosting.create({
    data: {
      ...rest,
      salaryMin: salaryMin ?? null,
      salaryMax: salaryMax ?? null,
      closingDate: closingDate ? new Date(closingDate) : null,
      publishedAt: rest.status === 'OPEN' ? new Date() : null,
      createdById: session.user.id,
    },
    include: { department: { select: { name: true } } },
  })
  return NextResponse.json({ success: true, data: job }, { status: 201 })
}
