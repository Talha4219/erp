import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

type Params = { params: { id: string } }

export const PATCH = withAuth(async (req: NextRequest, { params, session }: Params & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const { isPrimary, vendorId, ...rest } = body
    if (isPrimary && vendorId) {
      await prisma.supplierContact.updateMany({ where: { vendorId, deletedAt: null }, data: { isPrimary: false } })
    }
    const contact = await prisma.supplierContact.update({
      where: { id: params.id },
      data: { ...rest, ...(isPrimary !== undefined ? { isPrimary: Boolean(isPrimary) } : {}) },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, jobTitle: true, department: true, isPrimary: true, createdAt: true, vendorId: true },
    })
    return NextResponse.json(apiResponse(contact))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const DELETE = withAuth(async (_req: NextRequest, { params, session }: Params & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    await prisma.supplierContact.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
    return NextResponse.json(apiResponse(null))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
