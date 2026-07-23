import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'
import { randInt, randDate } from './utils'
import { HR_LEAVE_TYPES } from './constants'

export async function seedHR(
  prisma: PrismaClient,
  employeeIds: string[],
): Promise<void> {
  console.log('\n--- Seeding HR Module ---')

  const leaveTypeEntries: { id: string; daysPerYear: number }[] = []
  for (const lt of HR_LEAVE_TYPES) {
    const created = await prisma.leaveTypeConfig.upsert({
      where: { code: lt.code },
      update: {},
      create: {
        code: lt.code,
        name: lt.name,
        daysPerYear: lt.days,
        isPaid: lt.code !== 'UNPAID',
        carryForward: lt.code === 'ANNUAL',
        maxCarryDays: lt.code === 'ANNUAL' ? 10 : 0,
      },
    })
    leaveTypeEntries.push({ id: created.id, daysPerYear: lt.days })
  }
  console.log(` Leave Types: ${leaveTypeEntries.length}`)

  const year = 2026
  for (const empId of employeeIds) {
    for (const lte of leaveTypeEntries) {
      const entitled = lte.daysPerYear
      const used = randInt(0, Math.min(entitled, 10))
      const pending = randInt(0, Math.min(2, entitled - used))
      const remaining = entitled - used - pending

      await prisma.leaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId: empId, leaveTypeId: lte.id, year } },
        update: {},
        create: { employeeId: empId, leaveTypeId: lte.id, year, entitled, used, pending, remaining },
      })
    }
  }
  console.log(` Leave Balances: ${employeeIds.length} x ${leaveTypeEntries.length}`)

  const attendanceStart = new Date('2026-01-01')
  const attendanceEnd = new Date('2026-06-30')

  const allAttendance: {
    employeeId: string
    date: Date
    checkIn?: Date
    checkOut?: Date
    status: string
    hoursWorked?: number
  }[] = []

  for (const empId of employeeIds) {
    const numDays = randInt(60, 100)
    const usedDates = new Set<string>()

    for (let d = 0; d < numDays; d++) {
      let date: Date
      let dateStr: string
      let attempts = 0

      do {
        date = randDate(attendanceStart, attendanceEnd)
        if (date.getDay() === 6) date.setDate(date.getDate() + 1)
        if (date.getDay() === 5) date.setDate(date.getDate() + 1)
        dateStr = date.toISOString().split('T')[0]
        attempts++
      } while (usedDates.has(dateStr) && attempts < 20)

      if (usedDates.has(dateStr)) continue
      usedDates.add(dateStr)

      const status = faker.helpers.arrayElement(['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'ABSENT', 'HALF_DAY'])
      const checkIn = new Date(date)
      checkIn.setHours(8, randInt(0, 30), 0, 0)
      let hoursWorked = 8
      let checkOut: Date | undefined

      if (status === 'PRESENT') {
        checkOut = new Date(checkIn)
        checkOut.setHours(17, randInt(0, 30), 0, 0)
        hoursWorked = 8 + randInt(0, 2)
      } else if (status === 'HALF_DAY') {
        checkOut = new Date(checkIn)
        checkOut.setHours(12, 0, 0, 0)
        hoursWorked = 4
      }

      allAttendance.push({ employeeId: empId, date, checkIn, checkOut, status, hoursWorked })
    }
  }

  for (let i = 0; i < allAttendance.length; i += 200) {
    const batch = allAttendance.slice(i, i + 200)
    await Promise.all(batch.map((a) => prisma.attendance.create({ data: a }).catch(() => {})))
  }
  console.log(` Attendance records: ${allAttendance.length}`)
}
