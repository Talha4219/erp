import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

export const GET = withAuth(async (_req: NextRequest, { params, session }: Params & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true, email: true,
        phone: true, address: true, dateOfBirth: true, gender: true,
        profileImage: true, contractType: true, joinDate: true,
        isActive: true, createdAt: true, updatedAt: true,
        departmentId: true, designationId: true, employeeTypeId: true,
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        employeeType: { select: { id: true, typeName: true } },
      },
    })
    if (!employee) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: employee })
  } catch (err) {
    console.error('[GET /api/hr/employees/:id]', (err as Error).message)
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const PUT = withAuth(async (req: NextRequest, { params, session }: Params & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const body = await req.json()

    const joinDate = body.joinDate ? new Date(body.joinDate) : null
    if (!joinDate || isNaN(joinDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid join date' }, { status: 400 })
    }

    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: {
        employeeCode:  body.employeeCode,
        firstName:     body.firstName,
        lastName:      body.lastName,
        email:         body.email,
        department:    { connect: { id: body.departmentId } },
        designation:   { connect: { id: body.designationId } },
        contractType:  body.contractType,
        joinDate,
        basicSalary:   body.basicSalary ?? 0,
        phone:         body.phone        || null,
        gender:        body.gender       || null,
        address:       body.address      || null,
        bankAccount:   body.bankAccount  || null,
        bankName:      body.bankName     || null,
        profileImage:  body.profileImage || null,
        dateOfBirth:   body.dateOfBirth  ? new Date(body.dateOfBirth) : null,
        ...(body.employeeTypeId != null
          ? { employeeType: { connect: { id: body.employeeTypeId } } }
          : { employeeType: { disconnect: true } }),
      },
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true, email: true,
        phone: true, address: true, dateOfBirth: true, gender: true,
        profileImage: true, contractType: true, joinDate: true,
        isActive: true, createdAt: true, updatedAt: true,
        departmentId: true, designationId: true, employeeTypeId: true,
      },
    })

    return NextResponse.json({ success: true, data: employee })
  } catch (err) {
    console.error('[PUT /api/hr/employees/:id]', (err as Error).message)
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_req: NextRequest, { params, session }: Params & { session: AuthedSession }) => {
  try {
    if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    await prisma.employee.update({ where: { id: params.id }, data: { isActive: false, deletedAt: new Date() } })
    return NextResponse.json({ success: true, data: null })
  } catch (err) {
    console.error('[DELETE /api/hr/employees/:id]', (err as Error).message)
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
