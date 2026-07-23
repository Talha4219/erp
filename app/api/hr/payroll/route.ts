import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { calculateUKPayroll } from '@/lib/payroll/uk-tax'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employee')
  const month = searchParams.get('month')
  const year = searchParams.get('year')

  const payrolls = await prisma.payroll.findMany({
    where: {
      ...(employeeId && { employeeId }),
      ...(month && { month: parseInt(month) }),
      ...(year && { year: parseInt(year) }),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      items: { include: { component: { select: { id: true, name: true, type: true } } } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 200,
  })
  return NextResponse.json({ success: true, data: payrolls })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const { employeeId, month, year, allowances = 0, overtime = 0, notes, componentOverrides } = body

    const employee = await prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: { basicSalary: true, pensionEnrolled: true },
    })

    const basicMonthly = Number(employee.basicSalary)
    const annualBasic = basicMonthly * 12

    const uk = calculateUKPayroll(annualBasic, (allowances ?? 0) * 12, (overtime ?? 0) * 12, employee.pensionEnrolled)

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

    const payroll = await prisma.payroll.create({
      data: {
        employeeId,
        month,
        year,
        basicSalary: basicMonthly,
        allowances: allowances ?? 0,
        overtime: overtime ?? 0,
        grossSalary: uk.grossSalary,
        taxDeduction: uk.payeDeduction,
        socialSecurity: uk.niEmployee,
        otherDeductions: 0,
        payeDeduction: uk.payeDeduction,
        niEmployee: uk.niEmployee,
        niEmployer: uk.niEmployer,
        pensionEmployee: uk.pensionEmployee,
        pensionEmployer: uk.pensionEmployer,
        totalDeductions: uk.totalDeductions,
        netSalary: uk.netSalary,
        notes,
        items: { create: items },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        items: { include: { component: { select: { id: true, name: true, type: true } } } },
      },
    })

    return NextResponse.json({ success: true, data: payroll }, { status: 201 })
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ success: false, error: 'Payroll for this employee/month/year already exists' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
})
