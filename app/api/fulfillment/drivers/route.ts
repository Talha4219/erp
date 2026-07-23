import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { driverSchema } from '@/lib/validations/fulfillment'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest) => {
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const skip = (page - 1) * limit
  try {
    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where: { deletedAt: null },
        select: {
          id: true, name: true, licenseNumber: true, contactNumber: true,
          email: true, status: true, assignedVehicleId: true, notes: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.driver.count({ where: { deletedAt: null } }),
    ])
    return NextResponse.json({ success: true, data: drivers, meta: { total, page, limit } })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function postHandler(req: NextRequest) {
  const body = await req.json()
  const parsed = driverSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { name, licenseNumber, contactNumber, email, address, status, assignedVehicleId, notes } = parsed.data

  try {
    const driver = await prisma.driver.create({
      data: { name, licenseNumber, contactNumber, email: email || undefined, address, status, assignedVehicleId, notes },
      select: { id: true, name: true, licenseNumber: true, contactNumber: true, email: true, status: true, assignedVehicleId: true, notes: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: driver }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const POST = withRateLimit(withAudit(withAuth(postHandler) as Parameters<typeof withAudit>[0], 'Driver'))
