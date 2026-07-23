import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'
import { PASSWORD_HASH } from './utils'
import { PAKISTANI_MALE_NAMES, PAKISTANI_FEMALE_NAMES, PAKISTANI_LAST_NAMES } from './constants'

export async function seedUsers(
  prisma: PrismaClient,
  deptIds: string[],
  desigIds: string[],
  branchIds: string[],
  companyId: string,
): Promise<{ userIds: string[]; employeeIds: string[]; adminUserId: string }> {
  console.log('\n--- Seeding Users & Employees ---')

  await prisma.employeeType.createMany({
    data: [
      { typeName: 'Permanent', isBuiltIn: true },
      { typeName: 'Contract', isBuiltIn: true },
      { typeName: 'Intern', isBuiltIn: true },
      { typeName: 'Probation', isBuiltIn: true },
    ],
    skipDuplicates: true,
  })
  const empTypes = await prisma.employeeType.findMany()
  const empTypeMap = Object.fromEntries(empTypes.map((e) => [e.typeName, e.id]))

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@pakenterprise.com',
      name: 'Muhammad Ali',
      password: PASSWORD_HASH,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      phone: '+92-300-1234567',
      address: 'House 12, Street 5, Gulberg III, Lahore',
      defaultCompanyId: companyId,
      branchId: branchIds[0],
      departmentId: deptIds[0],
      onboardingDone: true,
      lastLoginAt: new Date('2026-07-01'),
    },
  })
  console.log(` Admin User: ${adminUser.email}`)

  const adminEmployee = await prisma.employee.create({
    data: {
      employeeCode: 'EMP-0001',
      userId: adminUser.id,
      firstName: 'Muhammad',
      lastName: 'Ali',
      email: adminUser.email,
      phone: '+92-300-1234567',
      gender: 'Male',
      nationalId: '35201-1234567-1',
      departmentId: deptIds[0],
      designationId: desigIds[0],
      contractType: 'FULL_TIME',
      employeeTypeId: empTypeMap['Permanent'],
      joinDate: new Date('2020-01-15'),
      basicSalary: 500000,
      niNumber: 'PK123456A',
      payrollId: 'PAY-0001',
      pensionEnrolled: true,
      rightToWorkProofSeen: true,
    },
  })
  console.log(` Admin Employee: ${adminEmployee.employeeCode}`)

  await prisma.department.update({
    where: { id: deptIds[0] },
    data: { managerId: adminEmployee.id },
  })

  const userIds: string[] = [adminUser.id]
  const employeeIds: string[] = [adminEmployee.id]

  const roleOrder: ('SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER')[] = [
    'ADMIN', 'ADMIN', 'MANAGER', 'MANAGER', 'MANAGER',
    'MANAGER', 'MANAGER', 'MANAGER', 'MANAGER', 'MANAGER',
    'OPERATOR', 'OPERATOR', 'OPERATOR', 'OPERATOR', 'OPERATOR',
    'VIEWER', 'VIEWER', 'VIEWER', 'VIEWER', 'VIEWER',
    'VIEWER', 'VIEWER', 'VIEWER', 'VIEWER', 'VIEWER',
  ]
  const allNames = [...PAKISTANI_MALE_NAMES.slice(0, 15), ...PAKISTANI_FEMALE_NAMES.slice(0, 10)]
  const contractTypes: Array<'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN'> = [
    'FULL_TIME', 'FULL_TIME', 'FULL_TIME', 'FULL_TIME', 'FULL_TIME',
    'FULL_TIME', 'FULL_TIME', 'CONTRACT', 'CONTRACT', 'PART_TIME',
    'FULL_TIME', 'FULL_TIME', 'CONTRACT', 'FULL_TIME', 'PART_TIME',
    'FULL_TIME', 'INTERN', 'FULL_TIME', 'CONTRACT', 'FULL_TIME',
    'PART_TIME', 'FULL_TIME', 'INTERN', 'FULL_TIME', 'CONTRACT',
  ]

  for (let i = 0; i < 25; i++) {
    const firstName = allNames[i]
    const lastName = faker.helpers.arrayElement(PAKISTANI_LAST_NAMES)
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@pakenterprise.com`
    const deptIdx = i % deptIds.length
    const desigIdx = Math.min(i + 1, desigIds.length - 1)
    const branchIdx = i % branchIds.length
    const role = roleOrder[i]
    const contract = contractTypes[i]

    const user = await prisma.user.create({
      data: {
        email,
        name: `${firstName} ${lastName}`,
        password: PASSWORD_HASH,
        role,
        status: 'ACTIVE',
        phone: faker.phone.number({ style: 'national' }),
        defaultCompanyId: companyId,
        branchId: branchIds[branchIdx],
        departmentId: deptIds[deptIdx],
        onboardingDone: true,
      },
    })
    userIds.push(user.id)

    const empCode = `EMP-${String(i + 2).padStart(4, '0')}`
    const basicSalary = [50000, 80000, 120000, 150000, 200000, 250000, 300000, 350000, 400000, 450000][
      Math.min(desigIdx, 9)
    ]
    const gender = i < 15 ? 'Male' : 'Female'

    const employee = await prisma.employee.create({
      data: {
        employeeCode: empCode,
        userId: user.id,
        firstName,
        lastName,
        email,
        phone: user.phone,
        gender,
        nationalId: faker.string.numeric(13),
        departmentId: deptIds[deptIdx],
        designationId: desigIds[desigIdx],
        contractType: contract,
        employeeTypeId: contract === 'INTERN' ? empTypeMap['Intern'] : contract === 'CONTRACT' ? empTypeMap['Contract'] : empTypeMap['Permanent'],
        joinDate: faker.date.between({ from: new Date('2021-01-01'), to: new Date('2025-12-31') }),
        basicSalary,
        pensionEnrolled: faker.datatype.boolean(0.7),
        rightToWorkProofSeen: true,
        niNumber: `PK${faker.string.numeric(6)}A`,
        payrollId: `PAY-${String(i + 2).padStart(4, '0')}`,
      },
    })
    employeeIds.push(employee.id)
  }

  for (let di = 1; di < deptIds.length; di++) {
    const managerEmpIdx = di % 10 + 1
    await prisma.department.update({
      where: { id: deptIds[di] },
      data: { managerId: employeeIds[managerEmpIdx] },
    })
  }

  console.log(` Users: ${userIds.length}`)
  console.log(` Employees: ${employeeIds.length}`)

  return { userIds, employeeIds, adminUserId: adminUser.id }
}
