import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

type Params = { params: { id: string } }

export const PATCH = withAuth<Params>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { action } = body

  if (action === 'post') {
    try {
      const entry = await prisma.journalEntry.update({
        where: { id: params.id },
        data: { status: 'POSTED', postedAt: new Date() },
      })
      return NextResponse.json({ success: true, data: entry })
    } catch (err) {
      return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
})
