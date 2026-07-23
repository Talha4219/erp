import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const now = new Date()
    const { searchParams } = new URL(req.url)
    const month = Number(searchParams.get('month') ?? now.getMonth() + 1)
    const year = Number(searchParams.get('year') ?? now.getFullYear())

    // Attendance dates are stored as UTC midnight (date-only strings parse as UTC) — build all
    // boundaries in UTC so they line up regardless of the server's local timezone.
    const monthStart = new Date(Date.UTC(year, month - 1, 1))
    const monthEnd = new Date(Date.UTC(year, month, 0))
    const todayStr = now.toISOString().slice(0, 10)

    const [employees, monthRecords] = await Promise.all([
      prisma.employee.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } },
        orderBy: { firstName: 'asc' },
      }),
      prisma.attendance.findMany({
        where: { date: { gte: monthStart, lte: monthEnd }, deletedAt: null },
        select: { employeeId: true, date: true, status: true },
      }),
    ])

    const totalEmployees = employees.length

    // Today's KPIs
    const todayRecords = monthRecords.filter((r) => r.date.toISOString().slice(0, 10) === todayStr)
    const todayByStatus = { PRESENT: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0 }
    for (const r of todayRecords) {
      if (r.status in todayByStatus) todayByStatus[r.status as keyof typeof todayByStatus]++
    }
    const markedToday = todayRecords.length
    const notMarkedToday = Math.max(0, totalEmployees - markedToday)
    const attendanceRateToday = totalEmployees > 0
      ? Math.round(((todayByStatus.PRESENT + todayByStatus.HALF_DAY * 0.5) / totalEmployees) * 100)
      : 0

    // Daily trend across the month
    const byDay: Record<string, { present: number; absent: number; leave: number; halfDay: number }> = {}
    for (const r of monthRecords) {
      const key = r.date.toISOString().slice(0, 10)
      if (!byDay[key]) byDay[key] = { present: 0, absent: 0, leave: 0, halfDay: 0 }
      if (r.status === 'PRESENT') byDay[key].present++
      else if (r.status === 'ABSENT') byDay[key].absent++
      else if (r.status === 'LEAVE') byDay[key].leave++
      else if (r.status === 'HALF_DAY') byDay[key].halfDay++
    }
    const trend = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, c]) => ({
        date,
        ...c,
        rate: totalEmployees > 0 ? Math.round(((c.present + c.halfDay * 0.5) / totalEmployees) * 100) : 0,
      }))

    // Per-employee monthly summary
    const byEmployee: Record<string, { present: number; absent: number; leave: number; halfDay: number }> = {}
    for (const r of monthRecords) {
      if (!byEmployee[r.employeeId]) byEmployee[r.employeeId] = { present: 0, absent: 0, leave: 0, halfDay: 0 }
      if (r.status === 'PRESENT') byEmployee[r.employeeId].present++
      else if (r.status === 'ABSENT') byEmployee[r.employeeId].absent++
      else if (r.status === 'LEAVE') byEmployee[r.employeeId].leave++
      else if (r.status === 'HALF_DAY') byEmployee[r.employeeId].halfDay++
    }
    const employeeSummaries = employees.map((e) => {
      const c = byEmployee[e.id] ?? { present: 0, absent: 0, leave: 0, halfDay: 0 }
      const markedDays = c.present + c.absent + c.leave + c.halfDay
      return {
        employeeId: e.id,
        name: `${e.firstName} ${e.lastName}`,
        employeeCode: e.employeeCode,
        department: e.department?.name ?? null,
        ...c,
        markedDays,
        rate: markedDays > 0 ? Math.round(((c.present + c.halfDay * 0.5) / markedDays) * 100) : 0,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalEmployees,
          presentToday: todayByStatus.PRESENT,
          absentToday: todayByStatus.ABSENT,
          onLeaveToday: todayByStatus.LEAVE,
          halfDayToday: todayByStatus.HALF_DAY,
          notMarkedToday,
          attendanceRateToday,
        },
        trend,
        employeeSummaries,
      },
    })
  } catch (err) {
    console.error('[hr/attendance/dashboard]', (err as Error).message)
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
