import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { apiError, apiErrorSafe } from '@/lib/utils'
import { z } from 'zod'

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  resumeUrl: z.string().optional(),
  coverLetter: z.string().optional(),
  source: z.enum(['WEBSITE','REFERRAL','COLD_CALL','EMAIL','SOCIAL_MEDIA','ADVERTISEMENT','OTHER']).default('OTHER'),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(apiError('Unauthorized'), { status: 401 })

  const apps = await prisma.jobApplication.findMany({
    where: { jobId: params.id },
    include: { interviews: { orderBy: { scheduledAt: 'asc' } } },
    orderBy: { appliedAt: 'desc' },
  })
  return NextResponse.json({ success: true, data: apps })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(apiError('Unauthorized'), { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json(apiErrorSafe(parsed.error, 'Validation failed'), { status: 400 })

  const app = await prisma.jobApplication.create({
    data: { ...parsed.data, jobId: params.id },
  })
  return NextResponse.json({ success: true, data: app }, { status: 201 })
}
