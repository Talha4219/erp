/**
 * Integration tests for Payroll API
 * Tests: GET /api/hr/payroll/[id], PATCH /api/hr/payroll/[id]
 */

import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: 'test-user-id', name: 'Test', email: 'test@erp.test', role: 'ADMIN' },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  }),
}))

jest.mock('@/lib/events/bus', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn() },
}))

const prisma = new PrismaClient()
let testPayrollId: string
let testEmployeeId: string

beforeAll(async () => {
  // Find or create a test employee
  const dept = await prisma.department.findFirst()
  const designation = await prisma.designation.findFirst()

  if (!dept || !designation) {
    console.warn('Missing dept/designation — payroll tests will be skipped')
    return
  }

  const employee = await prisma.employee.create({
    data: {
      employeeCode: `EMP-TEST-${Date.now()}`,
      firstName: 'Test',
      lastName: 'PayrollUser',
      email: `payroll-test-${Date.now()}@integration.test`,
      departmentId: dept.id,
      designationId: designation.id,
      joinDate: new Date('2025-01-01'),
      basicSalary: 3000,
    },
  })
  testEmployeeId = employee.id

  const payroll = await prisma.payroll.create({
    data: {
      employeeId: testEmployeeId,
      month: 6,
      year: 2026,
      basicSalary: 3000,
      grossSalary: 3200,
      totalDeductions: 600,
      netSalary: 2600,
      isPaid: false,
    },
  })
  testPayrollId = payroll.id
})

afterAll(async () => {
  if (testPayrollId) await prisma.payroll.delete({ where: { id: testPayrollId } }).catch(() => null)
  if (testEmployeeId) await prisma.employee.delete({ where: { id: testEmployeeId } }).catch(() => null)
  await prisma.$disconnect()
})

function makeParams(id: string) {
  return { params: { id } }
}

function makeReq(method: string, id: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/hr/payroll/${id}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/hr/payroll/[id]', () => {
  it('returns 404 for non-existent payroll', async () => {
    const { GET } = await import('@/app/api/hr/payroll/[id]/route')
    const req = makeReq('GET', 'nonexistent-id')
    const res = await GET(req, makeParams('nonexistent-id'))
    expect(res.status).toBe(404)
  })

  it('returns payroll record when found', async () => {
    if (!testPayrollId) return
    const { GET } = await import('@/app/api/hr/payroll/[id]/route')
    const req = makeReq('GET', testPayrollId)
    const res = await GET(req, makeParams(testPayrollId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.id).toBe(testPayrollId)
    expect(Number(body.data.netSalary)).toBe(2600)
  })
})

describe('PATCH /api/hr/payroll/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/lib/auth')
    ;(auth as jest.Mock).mockResolvedValueOnce(null)

    const { PATCH } = await import('@/app/api/hr/payroll/[id]/route')
    const req = makeReq('PATCH', 'some-id', { isPaid: true })
    const res = await PATCH(req, makeParams('some-id'))
    expect(res.status).toBe(401)
  })

  it('marks payroll as paid and emits payroll.approved event', async () => {
    if (!testPayrollId) return

    const { eventBus } = await import('@/lib/events/bus')
    const { PATCH } = await import('@/app/api/hr/payroll/[id]/route')

    const req = makeReq('PATCH', testPayrollId, { isPaid: true })
    const res = await PATCH(req, makeParams(testPayrollId))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.isPaid).toBe(true)
    expect(eventBus.emit).toHaveBeenCalledWith(
      'payroll.approved',
      expect.objectContaining({ payrollId: testPayrollId })
    )
  })
})
