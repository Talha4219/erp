import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events/bus'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'

export const GET = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const payroll = await prisma.payroll.findUnique({
    where: { id: params.id },
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, employeeCode: true,
          email: true, phone: true, address: true, bankAccount: true, bankName: true,
          niNumber: true, payrollId: true,
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
      items: {
        include: { component: { select: { id: true, name: true, type: true } } },
      },
    },
  })

  if (!payroll) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: payroll })
})

export const PATCH = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const payroll = await prisma.payroll.update({
      where: { id: params.id },
      data: {
        isPaid: body.isPaid,
        paidAt: body.isPaid ? new Date() : null,
        notes: body.notes,
      },
    })

    if (body.isPaid) {
      eventBus.emit('payroll.approved', {
        payrollId: payroll.id,
        employeeId: payroll.employeeId,
        netSalary: Number(payroll.netSalary),
        month: payroll.month,
        year: payroll.year,
        userId: session.user.id!,
      })
    }

    return NextResponse.json({ success: true, data: payroll })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
