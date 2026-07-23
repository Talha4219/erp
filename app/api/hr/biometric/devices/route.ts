import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (_req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const devices = await prisma.biometricDevice.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { logs: true } } },
  })
  return NextResponse.json({ success: true, data: devices })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const device = await prisma.biometricDevice.create({
      data: {
        name: body.name,
        deviceCode: body.deviceCode,
        location: body.location,
        ipAddress: body.ipAddress,
        isActive: body.isActive ?? true,
      },
    })
    return NextResponse.json({ success: true, data: device }, { status: 201 })
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ success: false, error: 'Device code already exists' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
})
