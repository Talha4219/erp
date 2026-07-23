import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fulfillmentSettingsSchema } from '@/lib/validations/fulfillment'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { withAuth } from '@/lib/api-middleware'
import { getUserCompanyId } from '@/lib/company-scope'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  const companyId = await getUserCompanyId(session.user.id!)
  try {
    let settings = await prisma.fulfillmentSettings.findUnique({ where: { companyId: companyId ?? '' } })
    if (!settings && companyId) {
      settings = await prisma.fulfillmentSettings.create({
        data: { companyId },
      })
    }
    return NextResponse.json({ success: true, data: settings })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function patchHandler(req: NextRequest, { session }: { session: import('@/lib/api-middleware').AuthedSession }) {
  const body = await req.json()
  const parsed = fulfillmentSettingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const companyId = await getUserCompanyId(session.user.id!)
  if (!companyId) return NextResponse.json({ success: false, error: 'No company configured' }, { status: 400 })

  try {
    const settings = await prisma.fulfillmentSettings.upsert({
      where: { companyId },
      update: parsed.data,
      create: { companyId, ...parsed.data },
    })
    return NextResponse.json({ success: true, data: settings })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const PATCH = withRateLimit(withAudit(withAuth(patchHandler) as Parameters<typeof withAudit>[0], 'FulfillmentSettings'))
