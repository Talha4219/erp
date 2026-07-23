import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const year = searchParams.get('year')

  const balances = await prisma.leaveBalance.findMany({
    where: {
      ...(employeeId && { employeeId }),
      ...(year && { year: parseInt(year) }),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      leaveType: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ employee: { firstName: 'asc' } }, { leaveType: { name: 'asc' } }],
  })
  return NextResponse.json({ success: true, data: balances })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    // bulk init: { employeeIds, year } — creates balances for all active leave types
    if (body.bulk) {
      const employees = body.employeeIds?.length
        ? await prisma.employee.findMany({ where: { id: { in: body.employeeIds }, isActive: true } })
        : await prisma.employee.findMany({ where: { isActive: true } })

      const leaveTypes = await prisma.leaveTypeConfig.findMany({ where: { isActive: true } })
      const year = body.year ?? new Date().getFullYear()

      // Query existing balances once to avoid individual upsert probes
      const existingBalances = await prisma.leaveBalance.findMany({
        where: {
          employeeId: { in: employees.map(e => e.id) },
          leaveTypeId: { in: leaveTypes.map(lt => lt.id) },
          year,
        },
        select: { employeeId: true, leaveTypeId: true },
      })
      const existingKeys = new Set(existingBalances.map(b => `${b.employeeId}|${b.leaveTypeId}`))

      const newBalances = employees.flatMap(emp =>
        leaveTypes
          .filter(lt => !existingKeys.has(`${emp.id}|${lt.id}`))
          .map(lt => ({
            employeeId: emp.id,
            leaveTypeId: lt.id,
            year,
            entitled: lt.daysPerYear,
            used: 0,
            pending: 0,
            remaining: lt.daysPerYear,
          }))
      )

      let created = 0
      for (let i = 0; i < newBalances.length; i += 100) {
        const chunk = newBalances.slice(i, i + 100)
        const result = await prisma.leaveBalance.createMany({ data: chunk })
        created += result.count
      }
      return NextResponse.json({ success: true, data: { created } }, { status: 201 })
    }

    // single upsert
    const entitled = Number(body.entitled ?? 0)
    const used = Number(body.used ?? 0)
    const pending = Number(body.pending ?? 0)
    const balance = await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: body.employeeId,
          leaveTypeId: body.leaveTypeId,
          year: body.year,
        },
      },
      create: {
        employeeId: body.employeeId,
        leaveTypeId: body.leaveTypeId,
        year: body.year,
        entitled,
        used,
        pending,
        remaining: entitled - used - pending,
      },
      update: {
        entitled,
        used,
        pending,
        remaining: entitled - used - pending,
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        leaveType: { select: { code: true, name: true } },
      },
    })
    return NextResponse.json({ success: true, data: balance }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
