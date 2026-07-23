import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const POST = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  const sessionUser = session.user as { role?: string }
  if (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  try {
    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: {
        firstName: 'ANONYMISED',
        lastName: 'ANONYMISED',
        email: `anon-${params.id}@deleted.invalid`,
        phone: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        nationalId: null,
        bankAccount: null,
        bankName: null,
        niNumber: null,
        profileImage: null,
        basicSalary: 0,
        isActive: false,
        deletedAt: new Date(),
      },
      select: { id: true, email: true, deletedAt: true },
    })

    await prisma.auditLog.create({
      data: {
        userId: (session.user as { id: string }).id,
        action: 'GDPR_ANONYMISE',
        entity: 'Employee',
        entityId: params.id,
        newValues: { isAnonymised: true },
      },
    })

    return NextResponse.json({ success: true, data: employee })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
