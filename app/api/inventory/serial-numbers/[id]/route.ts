import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

export const PUT = withAuth(async (req: NextRequest, { params, session }: { params: { id: string }; session: import('@/lib/api-middleware').AuthedSession }) => {
  if (!hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const { status, warehouseId, notes, warrantyExpiry } = body

  try {
    const serial = await prisma.serialNumber.update({
      where: { id: params.id },
      data: {
        ...(status ? { status } : {}),
        ...(warehouseId !== undefined ? { warehouseId: warehouseId || null } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(warrantyExpiry !== undefined ? { warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null } : {}),
      },
    })
    return NextResponse.json({ success: true, data: serial })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
