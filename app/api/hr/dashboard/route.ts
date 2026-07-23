import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async () => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const [
      totalEmployees, activeEmployees, newHires, pendingLeaves,
      attendance, deptDist, recentJoinees, pendingLeaveRequests, payrolls,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { isActive: true } }),
      prisma.employee.count({ where: { joinDate: { gte: startOfMonth } } }),
      prisma.leave.count({ where: { status: 'PENDING' } }),
      prisma.attendance.groupBy({
        by: ['status'],
        where: { date: today, deletedAt: null },
        _count: true,
      }),
      prisma.employee.groupBy({
        by: ['departmentId'],
        _count: true,
        where: { isActive: true },
      }),
      prisma.employee.findMany({
        where: { joinDate: { gte: startOfMonth } },
        include: { department: true, designation: true },
        orderBy: { joinDate: 'desc' },
        take: 5,
      }),
      prisma.leave.findMany({
        where: { status: 'PENDING' },
        include: { employee: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.payroll.findMany({
        where: {
          deletedAt: null,
          OR: Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            return { year: d.getFullYear(), month: d.getMonth() + 1 }
          }),
        },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
    ])

    // Department distribution with names
    const deptIds = deptDist.map(d => d.departmentId).filter(Boolean) as string[]
    const depts = deptIds.length
      ? await prisma.department.findMany({ where: { id: { in: deptIds } } })
      : []
    const deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]))

    const departmentDistribution = deptDist.map(d => ({
      name: deptMap[d.departmentId ?? ''] ?? 'Unknown',
      count: d._count,
    })).sort((a, b) => b.count - a.count).slice(0, 8)

    // Attendance counts (real statuses: PRESENT, ABSENT, HALF_DAY, LEAVE)
    const attCounts = { present: 0, absent: 0, halfDay: 0, onLeave: 0 }
    for (const a of attendance) {
      if (a.status === 'PRESENT') attCounts.present = a._count
      else if (a.status === 'ABSENT') attCounts.absent = a._count
      else if (a.status === 'HALF_DAY') attCounts.halfDay = a._count
      else if (a.status === 'LEAVE') attCounts.onLeave = a._count
    }

    // Payroll trend by month
    const payrollTrend = payrolls
      .filter(p => new Date(p.year, p.month - 1, 1) >= sixMonthsAgo)
      .map(p => ({
        month: new Date(p.year, p.month - 1, 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
        total: Number(p.netSalary ?? 0),
      }))

    const totalPayrollMtd = payrolls
      .filter(p => p.year === now.getFullYear() && p.month === now.getMonth() + 1)
      .reduce((s, p) => s + Number(p.netSalary ?? 0), 0)

    return NextResponse.json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        newHiresThisMonth: newHires,
        pendingLeaves,
        approvedLeavesToday: 0,
        totalPayrollMtd,
        openPositions: 0,
        attendance: attCounts,
        departmentDistribution,
        recentJoinees,
        pendingLeaveRequests,
        payrollTrend,
      },
    })
  } catch (err) {
    console.error('[hr/dashboard]', (err as Error).message)
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
