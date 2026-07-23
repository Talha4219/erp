import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

// Process unprocessed biometric logs into Attendance records.
export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { deviceId } = await req.json().catch(() => ({}))

  const logs = await prisma.biometricLog.findMany({
    where: {
      processed: false,
      employeeId: { not: null },
      ...(deviceId && { deviceId }),
    },
    orderBy: { punchTime: 'asc' },
  })

  let created = 0
  let updated = 0
  const errors: string[] = []

  await prisma.$transaction(async (tx) => {
    for (const log of logs) {
      try {
        const dateOnly = new Date(log.punchTime)
        dateOnly.setUTCHours(0, 0, 0, 0)

        const existing = await tx.attendance.findUnique({
          where: { employeeId_date: { employeeId: log.employeeId!, date: dateOnly } },
        })

        if (!existing) {
          await tx.attendance.create({
            data: {
              employeeId: log.employeeId!,
              date: dateOnly,
              status: 'PRESENT',
              checkIn: log.punchType === 'IN' || log.punchType === 'UNKNOWN' ? log.punchTime : null,
              checkOut: log.punchType === 'OUT' ? log.punchTime : null,
              notes: `Biometric sync (device: ${log.deviceId})`,
            },
          })
          created++
        } else {
          const updateData: Record<string, unknown> = {}
          if (log.punchType === 'IN' && !existing.checkIn) updateData.checkIn = log.punchTime
          if (log.punchType === 'OUT') updateData.checkOut = log.punchTime

          if (Object.keys(updateData).length > 0) {
            if (updateData.checkIn && existing.checkOut) {
              const diff = (existing.checkOut.getTime() - (updateData.checkIn as Date).getTime()) / 3600000
              updateData.hoursWorked = Math.round(diff * 100) / 100
            } else if (updateData.checkOut && existing.checkIn) {
              const diff = ((updateData.checkOut as Date).getTime() - existing.checkIn.getTime()) / 3600000
              updateData.hoursWorked = Math.round(diff * 100) / 100
            }
            await tx.attendance.update({ where: { id: existing.id }, data: updateData })
            updated++
          }
        }

        await tx.biometricLog.update({ where: { id: log.id }, data: { processed: true } })
      } catch (e) {
        errors.push(`Log ${log.id}: ${(e as Error).message}`)
      }
    }
  })

  return NextResponse.json({ success: true, data: { processed: logs.length, created, updated, errors } })
})

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const deviceId = searchParams.get('deviceId')
  const unprocessed = searchParams.get('unprocessed') === 'true'

  const logs = await prisma.biometricLog.findMany({
    where: {
      ...(deviceId && { deviceId }),
      ...(unprocessed && { processed: false }),
    },
    include: {
      device: { select: { name: true, deviceCode: true } },
      employee: { select: { firstName: true, lastName: true, employeeCode: true } },
    },
    orderBy: { punchTime: 'desc' },
    take: 200,
  })
  return NextResponse.json({ success: true, data: logs })
})
