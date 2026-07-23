import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModuleAccess } from '@/lib/authz'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'crm')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'CUSTOMER' | 'VENDOR' | null (all)
  const q = searchParams.get('q')?.toLowerCase() ?? ''

  const [customers, vendors] = await Promise.all([
    type === 'VENDOR' ? [] : prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { customerCode: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: {
        id: true, customerCode: true, name: true,
        email: true, phone: true, city: true, country: true,
        creditLimit: true, isActive: true, createdAt: true,
        _count: { select: { salesOrders: true, invoices: true } },
      },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    type === 'CUSTOMER' ? [] : prisma.vendor.findMany({
      where: {
        deletedAt: null,
        ...(q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { vendorCode: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: {
        id: true, vendorCode: true, name: true,
        email: true, phone: true, city: true, country: true,
        creditLimit: true, isActive: true, createdAt: true,
        _count: { select: { purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ])

  const data = [
    ...customers.map((c) => ({
      id: c.id,
      code: c.customerCode,
      name: c.name,
      type: 'CUSTOMER' as const,
      email: c.email,
      phone: c.phone,
      city: c.city,
      country: c.country,
      creditLimit: c.creditLimit,
      isActive: c.isActive,
      createdAt: c.createdAt,
      transactionCount: c._count.salesOrders + c._count.invoices,
    })),
    ...vendors.map((v) => ({
      id: v.id,
      code: v.vendorCode,
      name: v.name,
      type: 'VENDOR' as const,
      email: v.email,
      phone: v.phone,
      city: v.city,
      country: v.country ?? null,
      creditLimit: v.creditLimit,
      isActive: v.isActive,
      createdAt: v.createdAt,
      transactionCount: v._count.purchaseOrders,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ success: true, data })
}
