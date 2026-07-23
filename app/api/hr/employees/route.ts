import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  try {
    if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const department = searchParams.get('department')
    const contractType = searchParams.get('contractType')
    const employeeTypeId = searchParams.get('employeeTypeId')
    const status = searchParams.get('status')

    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { employeeCode: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(department && { department: { name: department } }),
        ...(contractType && { contractType: contractType as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' }),
        ...(employeeTypeId && { employeeTypeId: parseInt(employeeTypeId) }),
        ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
      },
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true, email: true,
        phone: true, profileImage: true, gender: true, contractType: true,
        joinDate: true, isActive: true, createdAt: true, updatedAt: true,
        departmentId: true, designationId: true, employeeTypeId: true,
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        employeeType: { select: { id: true, typeName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ success: true, data: { employees } })
  } catch (err) {
    console.error('[GET /api/hr/employees]', (err as Error).message)
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  try {
    if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const body = await req.json()

    const joinDate = body.joinDate ? new Date(body.joinDate) : null
    if (!joinDate || isNaN(joinDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid join date' }, { status: 400 })
    }

    const employee = await prisma.employee.create({
      data: {
        employeeCode: body.employeeCode,
        firstName:    body.firstName,
        lastName:     body.lastName,
        email:        body.email,
        department:   { connect: { id: body.departmentId } },
        designation:  { connect: { id: body.designationId } },
        contractType: body.contractType,
        joinDate,
        basicSalary:  body.basicSalary ?? 0,
        phone:        body.phone        || null,
        gender:       body.gender       || null,
        address:      body.address      || null,
        bankAccount:  body.bankAccount  || null,
        bankName:     body.bankName     || null,
        profileImage: body.profileImage || null,
        dateOfBirth:  body.dateOfBirth  ? new Date(body.dateOfBirth) : null,
        ...(body.employeeTypeId != null
          ? { employeeType: { connect: { id: body.employeeTypeId } } }
          : {}),
      },
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true, email: true,
        phone: true, profileImage: true, gender: true, contractType: true,
        joinDate: true, isActive: true, createdAt: true,
        departmentId: true, designationId: true, employeeTypeId: true,
      },
    })

    return NextResponse.json({ success: true, data: employee }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/hr/employees]', (err as Error).message)
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
