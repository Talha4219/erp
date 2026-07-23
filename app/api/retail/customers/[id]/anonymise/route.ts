import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthedSession } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const POST = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  const sessionUser = session.user as { role?: string }
  if (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  const id = parseInt(params.id)
  try {
    const customer = await prisma.retailCustomer.update({
      where: { id },
      data: {
        firstName: 'ANONYMISED',
        lastName: 'ANONYMISED',
        email: `anon-${id}@deleted.invalid`,
        phone: null,
        dateOfBirth: null,
        marketingOptIn: false,
        isAnonymised: true,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: (session.user as { id: string }).id,
        action: 'GDPR_ANONYMISE',
        entity: 'RetailCustomer',
        entityId: String(id),
        newValues: { isAnonymised: true },
      },
    })

    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
