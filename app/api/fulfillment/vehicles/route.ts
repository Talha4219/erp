import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { vehicleSchema } from '@/lib/validations/fulfillment'
import { nextDocNumber } from '@/lib/services/numbering'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest) => {
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const skip = (page - 1) * limit
  try {
    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.vehicle.count({ where: { deletedAt: null } }),
    ])
    return NextResponse.json({ success: true, data: vehicles, meta: { total, page, limit } })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function postHandler(req: NextRequest) {
  const body = await req.json()
  const parsed = vehicleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { vehicleNumber, make, model, year, capacity, capacityUnit, fuelType, registrationNo, insuranceExpiry, status, notes } = parsed.data

  try {
    const vehicleNumberValue = vehicleNumber || await nextDocNumber('vehicle')
    const vehicle = await prisma.vehicle.create({
      data: {
        vehicleNumber: vehicleNumberValue,
        make,
        model,
        year,
        capacity,
        capacityUnit,
        fuelType,
        registrationNo,
        insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : undefined,
        status,
        notes,
      },
    })
    return NextResponse.json({ success: true, data: vehicle }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const POST = withRateLimit(withAudit(withAuth(postHandler) as Parameters<typeof withAudit>[0], 'Vehicle'))
