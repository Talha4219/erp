import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const POST = withAuth<{ params: Promise<{ id: string }> }>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { disposalDate, disposalAmount, disposalNotes } = await req.json()
    const asset = await prisma.fixedAsset.update({
      where: { id: (await params).id },
      data: {
        status: 'DISPOSED',
        disposalDate: new Date(disposalDate),
        disposalAmount: disposalAmount ?? 0,
        disposalNotes,
      },
    })
    return NextResponse.json({ success: true, data: asset })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})
