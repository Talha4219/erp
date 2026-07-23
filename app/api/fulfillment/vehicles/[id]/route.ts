import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRateLimit, withAudit } from '@/lib/middleware'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const GET = withAuth<Params>(async (_req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.id },
      include: { assignments: { include: { driver: true } }, shipments: true, fulfillments: true },
    })
    if (!vehicle) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: vehicle })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

async function patchHandler(req: NextRequest, { params, session }: Params & { session: import('@/lib/api-middleware').AuthedSession }) {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const existing = await prisma.vehicle.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const allowed = ['vehicleNumber', 'make', 'model', 'year', 'capacity', 'capacityUnit', 'fuelType', 'registrationNo', 'insuranceExpiry', 'status', 'notes']
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) {
        data[key] = key === 'insuranceExpiry' ? new Date(body[key]) : body[key]
      }
    }

    const vehicle = await prisma.vehicle.update({ where: { id: params.id }, data })
    return NextResponse.json({ success: true, data: vehicle })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const PATCH = withRateLimit(withAudit(withAuth(patchHandler) as Parameters<typeof withAudit>[0], 'Vehicle'))

async function deleteHandler(req: NextRequest, { params, session }: Params & { session: import('@/lib/api-middleware').AuthedSession }) {
  if (!hasModuleAccess(session, 'fulfillment')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const existing = await prisma.vehicle.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    await prisma.vehicle.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export const DELETE = withRateLimit(withAudit(withAuth(deleteHandler) as Parameters<typeof withAudit>[0], 'Vehicle'))
