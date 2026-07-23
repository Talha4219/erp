import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { withAuth, AuthedSession } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { retailCustomerSchema } from '@/lib/validations/retail'

export const GET = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  try {
    const customer = await prisma.retailCustomer.findUnique({
      where: { id },
      include: { addresses: true },
    })
    if (!customer) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const PUT = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  const body = await req.json()
  const parsed = retailCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const { gdprConsentDate, dateOfBirth, ...rest } = parsed.data
    const customer = await prisma.retailCustomer.update({
      where: { id },
      data: {
        ...rest,
        gdprConsentDate: gdprConsentDate ? new Date(gdprConsentDate) : undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      },
    })
    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'pos')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  try {
    await prisma.retailCustomer.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
