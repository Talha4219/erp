import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { retailCustomerSchema } from '@/lib/validations/retail'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''

  try {
    const customers = await prisma.retailCustomer.findMany({
      where: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { addresses: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: customers })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = retailCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const { gdprConsentDate, dateOfBirth, ...rest } = parsed.data
    const customer = await prisma.retailCustomer.create({
      data: {
        ...rest,
        gdprConsentDate: gdprConsentDate ? new Date(gdprConsentDate) : null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
    })
    return NextResponse.json({ success: true, data: customer }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
