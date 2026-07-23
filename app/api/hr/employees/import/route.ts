import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { rows } = await req.json() as { rows: Record<string, string>[] }

  const departments = await prisma.department.findMany({ select: { id: true, name: true } })
  const designations = await prisma.designation.findMany({ select: { id: true, name: true } })

  const deptMap = Object.fromEntries(departments.map((d) => [d.name.toLowerCase(), d.id]))
  const desgMap = Object.fromEntries(designations.map((d) => [d.name.toLowerCase(), d.id]))

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
          employeeCode: row['Employee Code'],
          firstName:    row['First Name'],
          lastName:     row['Last Name'] ?? '',
          email:        row['Email'],
          phone:        row['Phone'] || null,
          dateOfBirth:  row['Date of Birth'] ? new Date(row['Date of Birth']) : null,
          gender:       row['Gender'] || null,
          address:      row['Address'] || null,
          department:   { connect: { id: deptId } },
          designation:  { connect: { id: desgId } },
          joinDate:     row['Join Date'] ? new Date(row['Join Date']) : new Date(),
          contractType: (row['Contract Type'] as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN') || 'FULL_TIME',
          basicSalary:  parseFloat(row['Basic Salary'] ?? '0') || 0,
          bankAccount:  row['Bank Account'] || null,
          bankName:     row['Bank Name'] || null,
          niNumber:     row['NI Number'] || null,
          payrollId:    row['Payroll ID'] || null,
        },
      })
      success++
    } catch (err) {
      errors.push(`Row ${rowNum}: ${(err as Error).message.split('\n')[0]}`)
    }
  }

  return NextResponse.json({ success, failed: rows.length - success, errors })
}
