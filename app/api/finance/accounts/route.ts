import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { accountSchema } from '@/lib/validations/finance'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  try {
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      include: {
        parent: true,
        children: true,
        _count: { select: { debitLines: true, creditLines: true } },
      },
      orderBy: { code: 'asc' },
    })
    return NextResponse.json({ success: true, data: accounts })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = accountSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const account = await prisma.account.create({ data: parsed.data })
    return NextResponse.json({ success: true, data: account }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})
