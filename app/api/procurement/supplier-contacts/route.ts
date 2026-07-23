import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    const contacts = await prisma.supplierContact.findMany({
      where: { deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, mobile: true, jobTitle: true, department: true,
        isPrimary: true, createdAt: true,
        vendor: { select: { id: true, name: true, vendorCode: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { firstName: 'asc' }],
    })
    return NextResponse.json(apiResponse(contacts))
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { vendorId, firstName, lastName, email, phone, mobile, jobTitle, department, isPrimary, notes } = body
    if (!vendorId || !firstName || !lastName) return NextResponse.json(apiError('vendorId, firstName, lastName required'), { status: 400 })
    if (isPrimary) {
      await prisma.supplierContact.updateMany({ where: { vendorId, deletedAt: null }, data: { isPrimary: false } })
    }
    const contact = await prisma.supplierContact.create({
      data: { vendorId, firstName, lastName, email, phone, mobile, jobTitle, department, isPrimary: Boolean(isPrimary), notes },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, mobile: true, jobTitle: true, department: true,
        isPrimary: true, createdAt: true,
        vendor: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(apiResponse(contact), { status: 201 })
  } catch { return NextResponse.json(apiError('Failed'), { status: 500 }) }
})
