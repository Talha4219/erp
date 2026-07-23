import prisma from '@/lib/prisma'
import { calculateUKPayroll } from '@/lib/payroll/uk-tax'
import { eventBus } from '@/lib/events/bus'

// ── Attendance ──────────────────────────────────────────────────────────

export function listAttendance(employeeId?: string | null, month?: string | null, year?: string | null) {
  const where: Record<string, unknown> = {}
  if (employeeId) where.employeeId = employeeId
  if (month && year) {
    const m = String(month).padStart(2, '0')
    const lastDay = new Date(parseInt(year!), parseInt(month!), 0).getDate()
    where.date = {
      gte: new Date(`${year}-${m}-01`),
      lte: new Date(`${year}-${m}-${lastDay}`),
    }
  }
  return prisma.attendance.findMany({
    where,
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
    orderBy: { date: 'desc' },
    take: 200,
  })
}

export function upsertAttendance(data: { employeeId: string; date: string; status?: string; checkIn?: string | null; checkOut?: string | null; notes?: string }) {
  return prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: data.employeeId, date: new Date(data.date) } },
    update: { status: data.status as any, checkIn: data.checkIn ? new Date(data.checkIn) : null, checkOut: data.checkOut ? new Date(data.checkOut) : null, notes: data.notes },
    create: { employeeId: data.employeeId, date: new Date(data.date), status: (data.status ?? 'PRESENT') as any, checkIn: data.checkIn ? new Date(data.checkIn) : null, checkOut: data.checkOut ? new Date(data.checkOut) : null },
  })
}

export async function getAttendanceDashboard(month: number, year: number) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0))
  const todayStr = new Date().toISOString().slice(0, 10)

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
  const todayRecords = monthRecords.filter(r => r.date.toISOString().slice(0, 10) === todayStr)
  const todayByStatus = { PRESENT: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0 }
  for (const r of todayRecords) {
    if (r.status in todayByStatus) todayByStatus[r.status as keyof typeof todayByStatus]++
  }
  const markedToday = todayRecords.length
  const notMarkedToday = Math.max(0, totalEmployees - markedToday)
  const attendanceRateToday = totalEmployees > 0
    ? Math.round(((todayByStatus.PRESENT + todayByStatus.HALF_DAY * 0.5) / totalEmployees) * 100) : 0

  const byDay: Record<string, { present: number; absent: number; leave: number; halfDay: number }> = {}
  for (const r of monthRecords) {
    const key = r.date.toISOString().slice(0, 10)
    if (!byDay[key]) byDay[key] = { present: 0, absent: 0, leave: 0, halfDay: 0 }
    if (r.status === 'PRESENT') byDay[key].present++
    else if (r.status === 'ABSENT') byDay[key].absent++
    else if (r.status === 'LEAVE') byDay[key].leave++
    else if (r.status === 'HALF_DAY') byDay[key].halfDay++
  }
  const trend = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, c]) => ({
    date, ...c,
    rate: totalEmployees > 0 ? Math.round(((c.present + c.halfDay * 0.5) / totalEmployees) * 100) : 0,
  }))

  const byEmployee: Record<string, { present: number; absent: number; leave: number; halfDay: number }> = {}
  for (const r of monthRecords) {
    if (!byEmployee[r.employeeId]) byEmployee[r.employeeId] = { present: 0, absent: 0, leave: 0, halfDay: 0 }
    if (r.status === 'PRESENT') byEmployee[r.employeeId].present++
    else if (r.status === 'ABSENT') byEmployee[r.employeeId].absent++
    else if (r.status === 'LEAVE') byEmployee[r.employeeId].leave++
    else if (r.status === 'HALF_DAY') byEmployee[r.employeeId].halfDay++
  }
  const employeeSummaries = employees.map(e => {
    const c = byEmployee[e.id] ?? { present: 0, absent: 0, leave: 0, halfDay: 0 }
    const markedDays = c.present + c.absent + c.leave + c.halfDay
    return { employeeId: e.id, name: `${e.firstName} ${e.lastName}`, employeeCode: e.employeeCode, department: e.department?.name ?? null, ...c, markedDays, rate: markedDays > 0 ? Math.round(((c.present + c.halfDay * 0.5) / markedDays) * 100) : 0 }
  })

  return {
    kpis: { totalEmployees, presentToday: todayByStatus.PRESENT, absentToday: todayByStatus.ABSENT, onLeaveToday: todayByStatus.LEAVE, halfDayToday: todayByStatus.HALF_DAY, notMarkedToday, attendanceRateToday },
    trend, employeeSummaries,
  }
}

// ── Biometric Devices ───────────────────────────────────────────────────

export function listBiometricDevices() {
  return prisma.biometricDevice.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { logs: true } } } })
}

export function createBiometricDevice(data: { name: string; deviceCode: string; location?: string; ipAddress?: string; isActive?: boolean }) {
  return prisma.biometricDevice.create({ data: { name: data.name, deviceCode: data.deviceCode, location: data.location, ipAddress: data.ipAddress, isActive: data.isActive ?? true } })
}

export function updateBiometricDevice(id: string, data: { name?: string; deviceCode?: string; location?: string; ipAddress?: string; isActive?: boolean }) {
  return prisma.biometricDevice.update({ where: { id }, data })
}

export function deleteBiometricDevice(id: string) {
  return prisma.biometricDevice.delete({ where: { id } })
}

export async function handleBiometricPunch(body: { deviceCode: string; rawUserId: string; punchTime: string; punchType?: string }) {
  const { deviceCode, rawUserId, punchTime, punchType = 'UNKNOWN' } = body
  const device = await prisma.biometricDevice.findUnique({ where: { deviceCode } })
  if (!device || !device.isActive) throw new Error('Device not found or inactive')
  const employee = await prisma.employee.findUnique({ where: { employeeCode: rawUserId } })
  const log = await prisma.biometricLog.create({
    data: { deviceId: device.id, rawUserId, employeeId: employee?.id ?? null, punchTime: new Date(punchTime), punchType: punchType as any, processed: false },
  })
  await prisma.biometricDevice.update({ where: { id: device.id }, data: { lastSyncAt: new Date() } })
  return { logId: log.id }
}

export async function syncBiometricLogs(deviceId?: string) {
  const logs = await prisma.biometricLog.findMany({
    where: { processed: false, employeeId: { not: null }, ...(deviceId && { deviceId }) },
    orderBy: { punchTime: 'asc' },
  })
  let created = 0, updated = 0
  const errors: string[] = []
  await prisma.$transaction(async (tx) => {
    for (const log of logs) {
      try {
        const dateOnly = new Date(log.punchTime)
        dateOnly.setUTCHours(0, 0, 0, 0)
        const existing = await tx.attendance.findUnique({ where: { employeeId_date: { employeeId: log.employeeId!, date: dateOnly } } })
        if (!existing) {
          await tx.attendance.create({
            data: {
              employeeId: log.employeeId!, date: dateOnly, status: 'PRESENT',
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
            const checkIn = updateData.checkIn as Date | undefined
            const checkOut = updateData.checkOut as Date | undefined
            if (checkIn && existing.checkOut) {
              updateData.hoursWorked = Math.round(((existing.checkOut.getTime() - checkIn.getTime()) / 3600000) * 100) / 100
            } else if (checkOut && existing.checkIn) {
              updateData.hoursWorked = Math.round(((checkOut.getTime() - existing.checkIn.getTime()) / 3600000) * 100) / 100
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
  return { processed: logs.length, created, updated, errors }
}

export function listBiometricLogs(deviceId?: string | null, unprocessed?: boolean) {
  return prisma.biometricLog.findMany({
    where: { ...(deviceId && { deviceId }), ...(unprocessed && { processed: false }) },
    include: { device: { select: { name: true, deviceCode: true } }, employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
    orderBy: { punchTime: 'desc' }, take: 200,
  })
}

// ── Dashboard ────────────────────────────────────────────────────────────

export async function getHrDashboard() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [totalEmployees, activeEmployees, newHires, pendingLeaves, attendance, deptDist, recentJoinees, pendingLeaveRequests, payrolls] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { joinDate: { gte: startOfMonth } } }),
    prisma.leave.count({ where: { status: 'PENDING' } }),
    prisma.attendance.groupBy({ by: ['status'], where: { date: today, deletedAt: null }, _count: true }),
    prisma.employee.groupBy({ by: ['departmentId'], _count: true, where: { isActive: true } }),
    prisma.employee.findMany({ where: { joinDate: { gte: startOfMonth } }, include: { department: true, designation: true }, orderBy: { joinDate: 'desc' }, take: 5 }),
    prisma.leave.findMany({ where: { status: 'PENDING' }, include: { employee: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.payroll.findMany({ where: { deletedAt: null, OR: Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return { year: d.getFullYear(), month: d.getMonth() + 1 } }) }, orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
  ])

  const deptIds = deptDist.map(d => d.departmentId).filter(Boolean) as string[]
  const depts = deptIds.length ? await prisma.department.findMany({ where: { id: { in: deptIds } } }) : []
  const deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]))
  const departmentDistribution = deptDist.map(d => ({ name: deptMap[d.departmentId ?? ''] ?? 'Unknown', count: d._count })).sort((a, b) => b.count - a.count).slice(0, 8)

  const attCounts = { present: 0, absent: 0, halfDay: 0, onLeave: 0 }
  for (const a of attendance) {
    if (a.status === 'PRESENT') attCounts.present = a._count
    else if (a.status === 'ABSENT') attCounts.absent = a._count
    else if (a.status === 'HALF_DAY') attCounts.halfDay = a._count
    else if (a.status === 'LEAVE') attCounts.onLeave = a._count
  }

  const payrollTrend = payrolls.map(p => ({ month: new Date(p.year, p.month - 1, 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' }), total: Number(p.netSalary ?? 0) }))
  const totalPayrollMtd = payrolls.filter(p => p.year === now.getFullYear() && p.month === now.getMonth() + 1).reduce((s, p) => s + Number(p.netSalary ?? 0), 0)

  return { totalEmployees, activeEmployees, newHiresThisMonth: newHires, pendingLeaves, approvedLeavesToday: 0, totalPayrollMtd, openPositions: 0, attendance: attCounts, departmentDistribution, recentJoinees, pendingLeaveRequests, payrollTrend }
}

// ── Departments ──────────────────────────────────────────────────────────

export function listDepartments() {
  return prisma.department.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } })
}

export function createDepartment(data: Record<string, unknown>) {
  return prisma.department.create({ data: data as any })
}

// ── Designations ─────────────────────────────────────────────────────────

export function listDesignations() {
  return prisma.designation.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } })
}

export function createDesignation(data: Record<string, unknown>) {
  return prisma.designation.create({ data: data as any })
}

// ── Employee Types ───────────────────────────────────────────────────────

export function listEmployeeTypes() {
  return prisma.employeeType.findMany({ orderBy: { typeName: 'asc' } })
}

export function createEmployeeType(typeName: string) {
  return prisma.employeeType.create({ data: { typeName } })
}

export function getEmployeeType(id: number) {
  return prisma.employeeType.findUnique({ where: { id } })
}

export function deleteEmployeeType(id: number) {
  return prisma.employeeType.delete({ where: { id } })
}

// ── Employees ────────────────────────────────────────────────────────────

const employeeListSelect = {
  id: true, employeeCode: true, firstName: true, lastName: true, email: true,
  phone: true, profileImage: true, gender: true, contractType: true,
  joinDate: true, isActive: true, createdAt: true, updatedAt: true,
  departmentId: true, designationId: true, employeeTypeId: true,
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  employeeType: { select: { id: true, typeName: true } },
}

const employeeDetailSelect = {
  id: true, employeeCode: true, firstName: true, lastName: true, email: true,
  phone: true, address: true, dateOfBirth: true, gender: true,
  profileImage: true, contractType: true, joinDate: true,
  isActive: true, createdAt: true, updatedAt: true,
  departmentId: true, designationId: true, employeeTypeId: true,
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  employeeType: { select: { id: true, typeName: true } },
}

export function listEmployees(params: { search?: string; department?: string | null; contractType?: string | null; employeeTypeId?: string | null; status?: string | null }) {
  const { search, department, contractType, employeeTypeId, status } = params
  return prisma.employee.findMany({
    where: {
      deletedAt: null,
      ...(search && { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { employeeCode: { contains: search, mode: 'insensitive' } }] }),
      ...(department && { department: { name: department } }),
      ...(contractType && { contractType: contractType as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' }),
      ...(employeeTypeId && { employeeTypeId: parseInt(employeeTypeId) }),
      ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
    },
    select: employeeListSelect,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

export function getEmployee(id: string) {
  return prisma.employee.findUnique({ where: { id }, select: employeeDetailSelect })
}

export function createEmployee(data: {
  employeeCode: string; firstName: string; lastName: string; email: string;
  departmentId: string; designationId: string; contractType: string;
  joinDate: string; basicSalary?: number;
  phone?: string; gender?: string; address?: string;
  bankAccount?: string; bankName?: string; profileImage?: string;
  dateOfBirth?: string; employeeTypeId?: number | null;
}) {
  if (!data.joinDate) throw new Error('Invalid join date')
  const joinDate = new Date(data.joinDate)
  if (isNaN(joinDate.getTime())) throw new Error('Invalid join date')
  return prisma.employee.create({
    data: {
      employeeCode: data.employeeCode, firstName: data.firstName, lastName: data.lastName, email: data.email,
      department: { connect: { id: data.departmentId } },
      designation: { connect: { id: data.designationId } },
      contractType: data.contractType as any, joinDate, basicSalary: data.basicSalary ?? 0,
      phone: data.phone || null, gender: data.gender || null, address: data.address || null,
      bankAccount: data.bankAccount || null, bankName: data.bankName || null,
      profileImage: data.profileImage || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      ...(data.employeeTypeId != null ? { employeeType: { connect: { id: data.employeeTypeId } } } : {}),
    },
    select: employeeListSelect,
  })
}

export function updateEmployee(id: string, data: {
  employeeCode?: string; firstName?: string; lastName?: string; email?: string;
  departmentId?: string; designationId?: string; contractType?: string;
  joinDate?: string; basicSalary?: number;
  phone?: string | null; gender?: string | null; address?: string | null;
  bankAccount?: string | null; bankName?: string | null; profileImage?: string | null;
  dateOfBirth?: string | null; employeeTypeId?: number | null;
}) {
  const updateData: Record<string, unknown> = {}
  if (data.employeeCode !== undefined) updateData.employeeCode = data.employeeCode
  if (data.firstName !== undefined) updateData.firstName = data.firstName
  if (data.lastName !== undefined) updateData.lastName = data.lastName
  if (data.email !== undefined) updateData.email = data.email
  if (data.departmentId) updateData.department = { connect: { id: data.departmentId } }
  if (data.designationId) updateData.designation = { connect: { id: data.designationId } }
  if (data.contractType !== undefined) updateData.contractType = data.contractType
  if (data.joinDate !== undefined) {
    const joinDate = new Date(data.joinDate)
    if (isNaN(joinDate.getTime())) throw new Error('Invalid join date')
    updateData.joinDate = joinDate
  }
  if (data.basicSalary !== undefined) updateData.basicSalary = data.basicSalary
  if (data.phone !== undefined) updateData.phone = data.phone
  if (data.gender !== undefined) updateData.gender = data.gender
  if (data.address !== undefined) updateData.address = data.address
  if (data.bankAccount !== undefined) updateData.bankAccount = data.bankAccount
  if (data.bankName !== undefined) updateData.bankName = data.bankName
  if (data.profileImage !== undefined) updateData.profileImage = data.profileImage
  if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null
  if (data.employeeTypeId !== undefined) {
    updateData.employeeType = data.employeeTypeId != null ? { connect: { id: data.employeeTypeId } } : { disconnect: true }
  }
  return prisma.employee.update({ where: { id }, data: updateData, select: employeeDetailSelect })
}

export function softDeleteEmployee(id: string) {
  return prisma.employee.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } })
}

export async function importEmployees(rows: Record<string, string>[]) {
  const departments = await prisma.department.findMany({ select: { id: true, name: true } })
  const designations = await prisma.designation.findMany({ select: { id: true, name: true } })
  const deptMap = Object.fromEntries(departments.map(d => [d.name.toLowerCase(), d.id]))
  const desgMap = Object.fromEntries(designations.map(d => [d.name.toLowerCase(), d.id]))
  let success = 0
  const errors: string[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    try {
      const deptId = deptMap[(row['Department'] ?? '').toLowerCase()]
      const desgId = desgMap[(row['Designation'] ?? '').toLowerCase()]
      if (!deptId) { errors.push(`Row ${rowNum}: Department "${row['Department']}" not found`); continue }
      if (!desgId) { errors.push(`Row ${rowNum}: Designation "${row['Designation']}" not found`); continue }
      if (!row['Employee Code']) { errors.push(`Row ${rowNum}: Employee Code is required`); continue }
      if (!row['First Name']) { errors.push(`Row ${rowNum}: First Name is required`); continue }
      if (!row['Email']) { errors.push(`Row ${rowNum}: Email is required`); continue }
      await prisma.employee.create({
        data: {
          employeeCode: row['Employee Code'], firstName: row['First Name'], lastName: row['Last Name'] ?? '',
          email: row['Email'], phone: row['Phone'] || null,
          dateOfBirth: row['Date of Birth'] ? new Date(row['Date of Birth']) : null, gender: row['Gender'] || null,
          address: row['Address'] || null, department: { connect: { id: deptId } },
          designation: { connect: { id: desgId } },
          joinDate: row['Join Date'] ? new Date(row['Join Date']) : new Date(),
          contractType: (row['Contract Type'] as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN') || 'FULL_TIME',
          basicSalary: parseFloat(row['Basic Salary'] ?? '0') || 0,
          bankAccount: row['Bank Account'] || null, bankName: row['Bank Name'] || null,
          niNumber: row['NI Number'] || null, payrollId: row['Payroll ID'] || null,
        },
      })
      success++
    } catch (err) {
      errors.push(`Row ${rowNum}: ${(err as Error).message.split('\n')[0]}`)
    }
  }
  return { success, failed: rows.length - success, errors }
}

export async function anonymiseEmployee(id: string, userId: string) {
  const employee = await prisma.employee.update({
    where: { id },
    data: {
      firstName: 'ANONYMISED', lastName: 'ANONYMISED', email: `anon-${id}@deleted.invalid`,
      phone: null, address: null, dateOfBirth: null, gender: null,
      nationalId: null, bankAccount: null, bankName: null, niNumber: null,
      profileImage: null, basicSalary: 0, isActive: false, deletedAt: new Date(),
    },
    select: { id: true, email: true, deletedAt: true },
  })
  await prisma.auditLog.create({
    data: { userId, action: 'GDPR_ANONYMISE', entity: 'Employee', entityId: id, newValues: { isAnonymised: true } },
  })
  return employee
}

// ── Employee Documents ──────────────────────────────────────────────────

export function listEmployeeDocuments(employeeId: string) {
  return prisma.employeeDocument.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' } })
}

export function createEmployeeDocument(employeeId: string, uploadedById: string | undefined, data: { docType?: string; title: string; fileUrl: string; fileSize?: number; expiryDate?: string; notes?: string }) {
  return prisma.employeeDocument.create({
      data: { employeeId, uploadedById, docType: (data.docType ?? 'OTHER') as any, title: data.title, fileUrl: data.fileUrl, fileSize: data.fileSize, expiryDate: data.expiryDate ? new Date(data.expiryDate) : null, notes: data.notes },
  })
}

export function deleteEmployeeDocument(id: string, employeeId: string) {
  return prisma.employeeDocument.delete({ where: { id, employeeId } })
}

// ── Employee Onboarding ─────────────────────────────────────────────────

export function listEmployeeOnboardings(employeeId: string) {
  return prisma.employeeOnboarding.findMany({ where: { employeeId }, include: { tasks: { orderBy: { sortOrder: 'asc' } } }, orderBy: { createdAt: 'desc' } })
}

export async function createEmployeeOnboarding(employeeId: string, data: { templateId?: string; type: string; startDate: string; notes?: string }) {
  let tasks: { title: string; description?: string; assignedRole?: string; dueDate?: Date; sortOrder: number }[] = []
  if (data.templateId) {
    const template = await prisma.onboardingTemplate.findUnique({ where: { id: data.templateId }, include: { tasks: { orderBy: { sortOrder: 'asc' } } } })
    if (template) {
      const start = new Date(data.startDate)
      tasks = template.tasks.map(t => ({ title: t.title, description: t.description ?? undefined, assignedRole: t.assignedRole ?? undefined, dueDate: t.dueAfterDays ? new Date(start.getTime() + t.dueAfterDays * 86400000) : undefined, sortOrder: t.sortOrder }))
    }
  }
  return prisma.employeeOnboarding.create({
    data: { employeeId, type: data.type as any, startDate: new Date(data.startDate), notes: data.notes, tasks: { create: tasks } },
    include: { tasks: { orderBy: { sortOrder: 'asc' } } },
  })
}

export async function updateOnboardingTask(onboardingId: string, taskId: string, body: { completed?: boolean; notes?: string }, userId?: string) {
  const task = await prisma.employeeOnboardingTask.update({
    where: { id: taskId, onboardingId },
    data: { completedAt: body.completed ? new Date() : null, completedById: body.completed ? userId : null, notes: body.notes },
  })
  const allTasks = await prisma.employeeOnboardingTask.findMany({ where: { onboardingId } })
  if (allTasks.every(t => t.completedAt)) {
    await prisma.employeeOnboarding.update({ where: { id: onboardingId }, data: { completedAt: new Date() } })
  }
  return task
}

// ── Leave Balances ──────────────────────────────────────────────────────

export function listLeaveBalances(employeeId?: string | null, year?: string | null) {
  return prisma.leaveBalance.findMany({
    where: { ...(employeeId && { employeeId }), ...(year && { year: parseInt(year) }) },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } }, leaveType: { select: { id: true, code: true, name: true } } },
    orderBy: [{ employee: { firstName: 'asc' } }, { leaveType: { name: 'asc' } }],
  })
}

export async function bulkInitLeaveBalances(employeeIds?: string[], year?: number) {
  const employees = employeeIds?.length
    ? await prisma.employee.findMany({ where: { id: { in: employeeIds }, isActive: true } })
    : await prisma.employee.findMany({ where: { isActive: true } })
  const leaveTypes = await prisma.leaveTypeConfig.findMany({ where: { isActive: true } })
  const y = year ?? new Date().getFullYear()
  const existingBalances = await prisma.leaveBalance.findMany({
    where: { employeeId: { in: employees.map(e => e.id) }, leaveTypeId: { in: leaveTypes.map(lt => lt.id) }, year: y },
    select: { employeeId: true, leaveTypeId: true },
  })
  const existingKeys = new Set(existingBalances.map(b => `${b.employeeId}|${b.leaveTypeId}`))
  const newBalances = employees.flatMap(emp =>
    leaveTypes.filter(lt => !existingKeys.has(`${emp.id}|${lt.id}`)).map(lt => ({
      employeeId: emp.id, leaveTypeId: lt.id, year: y, entitled: lt.daysPerYear, used: 0, pending: 0, remaining: lt.daysPerYear,
    }))
  )
  let created = 0
  for (let i = 0; i < newBalances.length; i += 100) {
    const result = await prisma.leaveBalance.createMany({ data: newBalances.slice(i, i + 100) })
    created += result.count
  }
  return { created }
}

export function upsertLeaveBalance(data: { employeeId: string; leaveTypeId: string; year: number; entitled?: number; used?: number; pending?: number }) {
  const entitled = Number(data.entitled ?? 0)
  const used = Number(data.used ?? 0)
  const pending = Number(data.pending ?? 0)
  return prisma.leaveBalance.upsert({
    where: { employeeId_leaveTypeId_year: { employeeId: data.employeeId, leaveTypeId: data.leaveTypeId, year: data.year } },
    create: { employeeId: data.employeeId, leaveTypeId: data.leaveTypeId, year: data.year, entitled, used, pending, remaining: entitled - used - pending },
    update: { entitled, used, pending, remaining: entitled - used - pending },
    include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } }, leaveType: { select: { code: true, name: true } } },
  })
}

export function updateLeaveBalance(id: string, data: { entitled?: number; used?: number; pending?: number }) {
  const entitled = Number(data.entitled ?? 0)
  const used = Number(data.used ?? 0)
  const pending = Number(data.pending ?? 0)
  return prisma.leaveBalance.update({ where: { id }, data: { entitled, used, pending, remaining: entitled - used - pending } })
}

// ── Leave Types ─────────────────────────────────────────────────────────

export function listLeaveTypes() {
  return prisma.leaveTypeConfig.findMany({ orderBy: { name: 'asc' } })
}

export function createLeaveType(data: { code: string; name: string; daysPerYear?: number; isPaid?: boolean; carryForward?: boolean; maxCarryDays?: number; description?: string; isActive?: boolean }) {
  return prisma.leaveTypeConfig.create({
    data: { code: data.code.toUpperCase(), name: data.name, daysPerYear: data.daysPerYear ?? 0, isPaid: data.isPaid ?? true, carryForward: data.carryForward ?? false, maxCarryDays: data.maxCarryDays ?? 0, description: data.description, isActive: data.isActive ?? true },
  })
}

export function updateLeaveType(id: string, data: Record<string, unknown>) {
  return prisma.leaveTypeConfig.update({ where: { id }, data: data as any })
}

export function deleteLeaveType(id: string) {
  return prisma.leaveTypeConfig.delete({ where: { id } })
}

// ── Leaves ──────────────────────────────────────────────────────────────

export function listLeaves(status?: string | null, employeeId?: string | null) {
  return prisma.leave.findMany({
    where: { ...(status && { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }), ...(employeeId && { employeeId }) },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } } },
    orderBy: { startDate: 'desc' }, take: 100,
  })
}

export function createLeave(data: { employeeId: string; leaveType: string; startDate: string; endDate: string; totalDays: number; reason?: string }) {
  return prisma.leave.create({
    data: { employeeId: data.employeeId, leaveType: data.leaveType as any, startDate: new Date(data.startDate), endDate: new Date(data.endDate), totalDays: data.totalDays, reason: data.reason },
  })
}

export async function updateLeaveStatus(id: string, status: string) {
  if (!['APPROVED', 'REJECTED'].includes(status)) throw new Error('Invalid status')
  // If approving, deduct from leave balance
  let result
  await prisma.$transaction(async (tx) => {
    const leave = await tx.leave.update({
      where: { id },
      data: { status: status as any, approvedAt: status === 'APPROVED' ? new Date() : null },
    })
    if (status === 'APPROVED') {
      const balance = await tx.leaveBalance.findFirst({
        where: { employeeId: leave.employeeId, leaveType: { code: leave.leaveType }, year: new Date().getFullYear() },
      })
      if (balance) {
        const newUsed = Number(balance.used) + leave.totalDays
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { used: newUsed, remaining: Number(balance.entitled) - newUsed - Number(balance.pending) },
        })
      }
    }
    result = leave
  })
  return result!
}

// ── Onboarding Templates ────────────────────────────────────────────────

export function listOnboardingTemplates(type?: string | null) {
  return prisma.onboardingTemplate.findMany({
    where: { ...(type && { type: type as 'ONBOARDING' | 'OFFBOARDING' }), isActive: true },
    include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { name: 'asc' },
  })
}

export function createOnboardingTemplate(data: { name: string; type: string; description?: string; tasks?: { title: string; description?: string; sortOrder?: number }[] }) {
  const { tasks = [], ...rest } = data
  return prisma.onboardingTemplate.create({ data: { ...rest, tasks: { create: tasks } } as any, include: { tasks: { orderBy: { sortOrder: 'asc' } } } })
}

export function getOnboardingTemplate(id: string) {
  return prisma.onboardingTemplate.findUnique({ where: { id }, include: { tasks: { orderBy: { sortOrder: 'asc' } } } })
}

export async function updateOnboardingTemplate(id: string, data: { name?: string; type?: string; description?: string; tasks?: { title: string; description?: string; sortOrder?: number; assignedRole?: string }[] }) {
  const { tasks, ...rest } = data
  return prisma.$transaction(async (tx) => {
    if (tasks) await tx.onboardingTemplateTask.deleteMany({ where: { templateId: id } })
    return tx.onboardingTemplate.update({
      where: { id },
      data: { ...rest, tasks: tasks ? { create: tasks } : undefined } as any,
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    })
  })
}

export function deleteOnboardingTemplate(id: string) {
  return prisma.onboardingTemplate.delete({ where: { id } })
}

// ── Payroll ─────────────────────────────────────────────────────────────

export function listPayrolls(employeeId?: string | null, month?: string | null, year?: string | null) {
  return prisma.payroll.findMany({
    where: {
      ...(employeeId && { employeeId }),
      ...(month && { month: parseInt(month) }),
      ...(year && { year: parseInt(year) }),
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } }, items: { include: { component: { select: { id: true, name: true, type: true } } } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 200,
  })
}

export async function generatePayroll(data: { employeeId: string; month: number; year: number; allowances?: number; overtime?: number; notes?: string; componentOverrides?: Record<string, number> }) {
  const { employeeId, month, year, allowances = 0, overtime = 0, notes, componentOverrides } = data
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { basicSalary: true, pensionEnrolled: true } })
  const basicMonthly = Number(employee.basicSalary)
  const annualBasic = basicMonthly * 12
  const uk = calculateUKPayroll(annualBasic, allowances * 12, overtime * 12, employee.pensionEnrolled)
  const activeComponents = await prisma.salaryComponent.findMany({ where: { isActive: true } })
  const items: { componentId: string; amount: number }[] = []
  for (const comp of activeComponents) {
    let amount = 0
    if (comp.calcMethod === 'FIXED') {
      amount = Number(comp.value)
    } else {
      amount = (basicMonthly * Number(comp.value)) / 100
    }
    if (componentOverrides?.[comp.id] !== undefined) {
      amount = Number(componentOverrides[comp.id])
    }
    items.push({ componentId: comp.id, amount })
  }
  return prisma.payroll.create({
    data: {
      employeeId, month, year, basicSalary: basicMonthly, allowances, overtime,
      grossSalary: uk.grossSalary, taxDeduction: uk.payeDeduction, socialSecurity: uk.niEmployee,
      otherDeductions: 0, payeDeduction: uk.payeDeduction, niEmployee: uk.niEmployee,
      niEmployer: uk.niEmployer, pensionEmployee: uk.pensionEmployee, pensionEmployer: uk.pensionEmployer,
      totalDeductions: uk.totalDeductions, netSalary: uk.netSalary, notes,
      items: { create: items },
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } }, items: { include: { component: { select: { id: true, name: true, type: true } } } } },
  })
}

export function getPayroll(id: string) {
  return prisma.payroll.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true, phone: true, address: true, bankAccount: true, bankName: true, niNumber: true, payrollId: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
      items: { include: { component: { select: { id: true, name: true, type: true } } } },
    },
  })
}

export async function updatePayrollStatus(id: string, data: { isPaid: boolean; notes?: string }, userId?: string) {
  const payroll = await prisma.payroll.update({
    where: { id },
    data: { isPaid: data.isPaid, paidAt: data.isPaid ? new Date() : null, notes: data.notes },
  })
  if (data.isPaid) {
    eventBus.emit('payroll.approved', {
      payrollId: payroll.id, employeeId: payroll.employeeId, netSalary: Number(payroll.netSalary),
      month: payroll.month, year: payroll.year, userId,
    })
  }
  return payroll
}

// ── Performance ─────────────────────────────────────────────────────────

// Appraisals
export function listPerformanceAppraisals(employeeId?: string | null, year?: string | null, status?: string | null) {
  return prisma.performanceAppraisal.findMany({
    where: {
      ...(employeeId && { employeeId }), ...(year && { year: parseInt(year) }),
      ...(status && { status: status as 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'APPROVED' }),
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } }, reviewer: { select: { id: true, firstName: true, lastName: true } }, criteria: true },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
  })
}

export function createPerformanceAppraisal(data: { employeeId: string; reviewerId: string; period: string; year?: number; selfComments?: string; reviewerComments?: string; criteria?: { criteria: string; weight?: number }[] }) {
  return prisma.performanceAppraisal.create({
    data: {
      employeeId: data.employeeId, reviewerId: data.reviewerId, period: data.period as any, year: data.year ?? new Date().getFullYear(), status: 'DRAFT',
      selfComments: data.selfComments, reviewerComments: data.reviewerComments,
      criteria: data.criteria?.length ? { create: data.criteria.map(c => ({ criteria: c.criteria, weight: c.weight ?? 1 })) } : undefined,
    },
    include: { employee: { select: { firstName: true, lastName: true } }, criteria: true },
  })
}

export function getPerformanceAppraisal(id: string) {
  return prisma.performanceAppraisal.findUnique({
    where: { id },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } }, reviewer: { select: { id: true, firstName: true, lastName: true } }, criteria: true },
  })
}

export function updatePerformanceAppraisal(id: string, data: { reviewerId?: string; status?: string; overallScore?: number; selfComments?: string; reviewerComments?: string; criteria?: { criteria: string; weight?: number; selfScore?: number; reviewerScore?: number; comments?: string }[] }) {
  const statusDates: Record<string, unknown> = {}
  if (data.status === 'SUBMITTED') statusDates.submittedAt = new Date()
  if (data.status === 'REVIEWED') statusDates.reviewedAt = new Date()
  if (data.status === 'APPROVED') statusDates.approvedAt = new Date()
  return prisma.performanceAppraisal.update({
    where: { id },
    data: {
      reviewerId: data.reviewerId, status: data.status as any, overallScore: data.overallScore,
      selfComments: data.selfComments, reviewerComments: data.reviewerComments,
      ...statusDates,
      criteria: data.criteria ? { deleteMany: {}, create: data.criteria.map(c => ({ criteria: c.criteria, weight: c.weight ?? 1, selfScore: c.selfScore, reviewerScore: c.reviewerScore, comments: c.comments })) } : undefined,
    },
    include: { criteria: true },
  })
}

// KPIs
export function listEmployeeKpis(employeeId?: string | null, year?: string | null, quarter?: string | null) {
  return prisma.employeeKpi.findMany({
    where: { ...(employeeId && { employeeId }), ...(year && { year: parseInt(year) }), ...(quarter && { quarter: parseInt(quarter) }) },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } }, kpi: { select: { id: true, name: true, category: true, targetType: true, unit: true } } },
    orderBy: [{ year: 'desc' }, { quarter: 'asc' }],
  })
}

export function createEmployeeKpi(data: { employeeId: string; kpiId: string; year?: number; quarter?: number; target: number; actual?: number; score?: number; notes?: string }) {
  return prisma.employeeKpi.create({
    data: { employeeId: data.employeeId, kpiId: data.kpiId, year: data.year ?? new Date().getFullYear(), quarter: data.quarter ?? null, target: data.target, actual: data.actual ?? null, score: data.score ?? null, notes: data.notes },
    include: { employee: { select: { firstName: true, lastName: true } }, kpi: { select: { name: true, targetType: true, unit: true } } },
  })
}

export function updateEmployeeKpi(id: string, data: { target?: number; actual?: number; score?: number; notes?: string }) {
  return prisma.employeeKpi.update({ where: { id }, data })
}

export function deleteEmployeeKpi(id: string) {
  return prisma.employeeKpi.delete({ where: { id } })
}

// KPI Templates
export function listKpiTemplates() {
  return prisma.kpiTemplate.findMany({ orderBy: { name: 'asc' } })
}

export function createKpiTemplate(data: { name: string; description?: string; category: string; targetType?: string; unit?: string; isActive?: boolean }) {
  return prisma.kpiTemplate.create({ data: { name: data.name, description: data.description, category: data.category, targetType: data.targetType ?? 'NUMERIC', unit: data.unit, isActive: data.isActive ?? true } as any })
}

export function updateKpiTemplate(id: string, data: Record<string, unknown>) {
  return prisma.kpiTemplate.update({ where: { id }, data: data as any })
}

export function deleteKpiTemplate(id: string) {
  return prisma.kpiTemplate.delete({ where: { id } })
}

// Reviews
export function listPerformanceReviews(employeeId?: string | null, reviewType?: string | null) {
  return prisma.performanceReview.findMany({
    where: { ...(employeeId && { employeeId }), ...(reviewType && { reviewType: reviewType as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'PROBATION' | 'PIP' }) },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } }, reviewer: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { reviewDate: 'desc' }, take: 200,
  })
}

export function createPerformanceReview(data: { employeeId: string; reviewerId: string; reviewDate: string; reviewType: string; summary?: string; strengths?: string; improvements?: string; actionItems?: string; nextReviewDate?: string }) {
  return prisma.performanceReview.create({
    data: { employeeId: data.employeeId, reviewerId: data.reviewerId, reviewDate: new Date(data.reviewDate), reviewType: data.reviewType as any, summary: data.summary, strengths: data.strengths, improvements: data.improvements, actionItems: data.actionItems, nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null },
    include: { employee: { select: { firstName: true, lastName: true } }, reviewer: { select: { firstName: true, lastName: true } } },
  })
}

export function getPerformanceReview(id: string) {
  return prisma.performanceReview.findUnique({
    where: { id },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } }, reviewer: { select: { id: true, firstName: true, lastName: true } } },
  })
}

export function updatePerformanceReview(id: string, data: Record<string, unknown>) {
  const updateData: Record<string, unknown> = { ...data }
  if (data.reviewDate) updateData.reviewDate = new Date(data.reviewDate as string)
  if (data.nextReviewDate !== undefined) updateData.nextReviewDate = data.nextReviewDate ? new Date(data.nextReviewDate as string) : null
  return prisma.performanceReview.update({ where: { id }, data: updateData as any })
}

export function deletePerformanceReview(id: string) {
  return prisma.performanceReview.delete({ where: { id } })
}

// ── Salary Components ───────────────────────────────────────────────────

export function listSalaryComponents() {
  return prisma.salaryComponent.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] })
}

export function createSalaryComponent(data: Record<string, unknown>) {
  return prisma.salaryComponent.create({ data: data as any })
}

export function updateSalaryComponent(id: string, data: Record<string, unknown>) {
  return prisma.salaryComponent.update({ where: { id }, data: data as any })
}

export function deleteSalaryComponent(id: string) {
  return prisma.salaryComponent.delete({ where: { id } })
}

// ── Shifts ──────────────────────────────────────────────────────────────

export function listShifts(from?: string | null, to?: string | null, employeeId?: string | null) {
  return prisma.shiftRoster.findMany({
    where: { ...(from && to && { shiftDate: { gte: new Date(from), lte: new Date(to) } }), ...(employeeId && { employeeId }) },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
    orderBy: [{ shiftDate: 'asc' }, { startTime: 'asc' }],
  })
}

export function createShift(data: { employeeId: string; shiftDate: string; startTime: string; endTime: string }) {
  return prisma.shiftRoster.create({
    data: { employeeId: data.employeeId, shiftDate: new Date(data.shiftDate), startTime: data.startTime, endTime: data.endTime },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
  })
}

export function updateShift(id: number, data: { employeeId?: string; shiftDate?: string; startTime?: string; endTime?: string }) {
  return prisma.shiftRoster.update({
    where: { id },
    data: { employeeId: data.employeeId, shiftDate: data.shiftDate ? new Date(data.shiftDate) : undefined, startTime: data.startTime, endTime: data.endTime },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
  })
}

export function deleteShift(id: number) {
  return prisma.shiftRoster.delete({ where: { id } })
}
