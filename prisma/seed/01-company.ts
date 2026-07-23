import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'
import { COMPANY_NAME, DEPARTMENTS, DESIGNATIONS, WAREHOUSE_NAMES, COST_CENTRES } from './constants'

export async function seedCompany(prisma: PrismaClient): Promise<{
  companyId: string
  branchIds: string[]
  departmentIds: string[]
  designationIds: string[]
  warehouseIds: string[]
  costCentreIds: string[]
  fiscalYearIds: string[]
  accountingPeriodIds: string[]
  paymentTermIds: string[]
  numberingSeriesIds: string[]
}> {
  console.log('\n--- Seeding Company Structure ---')

  const company = await prisma.company.create({
    data: {
      code: 'PAK-ENT-001',
      name: COMPANY_NAME,
      legalName: 'Pak Enterprise Solutions (Pvt) Limited',
      address: '14-B, Main Boulevard, Gulberg III',
      city: 'Lahore',
      country: 'PK',
      phone: '+92-42-35712345',
      email: 'info@pakenterprise.com',
      taxId: 'NTN-1234567-8',
      registrationNo: 'SECP-0098765',
      currency: 'PKR',
      fiscalYearStart: 7,
    },
  })
  console.log(` Company: ${company.name}`)

  const branchIds: string[] = []
  const branchCities = ['Lahore', 'Karachi', 'Islamabad', 'Faisalabad', 'Sialkot']
  for (let i = 0; i < branchCities.length; i++) {
    const branch = await prisma.branch.create({
      data: {
        companyId: company.id,
        code: `BR-${String(i + 1).padStart(2, '0')}`,
        name: `${branchCities[i]} Branch`,
        address: faker.location.streetAddress(),
        city: branchCities[i],
        phone: faker.phone.number({ style: 'national' }),
        email: `branch${i + 1}@pakenterprise.com`,
        isHead: i === 0,
      },
    })
    branchIds.push(branch.id)
  }
  console.log(` Branches: ${branchIds.length}`)

  const departmentIds: string[] = []
  for (const d of DEPARTMENTS) {
    const dept = await prisma.department.create({
      data: {
        name: d.name,
        code: d.code,
        description: `${d.name} Department`,
      },
    })
    departmentIds.push(dept.id)
  }
  console.log(` Departments: ${departmentIds.length}`)

  const designationIds: string[] = []
  for (const d of DESIGNATIONS) {
    const desig = await prisma.designation.create({
      data: {
        name: d.name,
        code: d.code,
        level: d.level,
      },
    })
    designationIds.push(desig.id)
  }
  console.log(` Designations: ${designationIds.length}`)

  const warehouseIds: string[] = []
  for (const w of WAREHOUSE_NAMES) {
    const wh = await prisma.warehouse.create({
      data: {
        code: w.code,
        name: w.name,
        address: `${faker.location.streetAddress()}, ${faker.location.city()}`,
      },
    })
    warehouseIds.push(wh.id)
  }
  console.log(` Warehouses: ${warehouseIds.length}`)

  const costCentreIds: string[] = []
  for (const cc of COST_CENTRES) {
    const c = await prisma.costCentre.create({
      data: {
        code: cc.toUpperCase().replace(/[\s&]+/g, '_').slice(0, 10),
        name: cc,
        description: `Cost centre for ${cc}`,
      },
    })
    costCentreIds.push(c.id)
  }
  console.log(` Cost Centres: ${costCentreIds.length}`)

  const fy = await prisma.fiscalYear.create({
    data: {
      companyId: company.id,
      name: 'FY 2025-2026',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2026-06-30'),
      isCurrent: true,
    },
  })

  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  const accountingPeriodIds: string[] = []
  for (let i = 0; i < 12; i++) {
    const ap = await prisma.accountingPeriod.create({
      data: {
        fiscalYearId: fy.id,
        name: months[i] + ' 2025-2026',
        startDate: new Date(2025 + Math.floor((6 + i) / 12), (6 + i) % 12, 1),
        endDate: new Date(2025 + Math.floor((6 + i + 1) / 12), (6 + i + 1) % 12, 0),
      },
    })
    accountingPeriodIds.push(ap.id)
  }
  console.log(` Fiscal Year + ${accountingPeriodIds.length} periods`)

  const paymentTermIds: string[] = []
  const terms = [
    { code: 'NET30', name: 'Net 30 Days', type: 'NET_DAYS' as const, netDays: 30 },
    { code: 'NET60', name: 'Net 60 Days', type: 'NET_DAYS' as const, netDays: 60 },
    { code: 'COD', name: 'Cash on Delivery', type: 'CASH_ON_DELIVERY' as const, netDays: 0 },
    { code: 'PREPAID', name: 'Prepaid', type: 'PREPAID' as const, netDays: 0 },
    { code: 'EOM', name: 'End of Month', type: 'END_OF_MONTH' as const, netDays: 0 },
  ]
  for (const t of terms) {
    const pt = await prisma.paymentTerm.create({
      data: { code: t.code, name: t.name, type: t.type, netDays: t.netDays },
    })
    paymentTermIds.push(pt.id)
  }
  console.log(` Payment Terms: ${paymentTermIds.length}`)

  const numberingSeriesIds: string[] = []
  const series: { module: string; prefix: string; padding: number; resetAnnually?: boolean; isDefault?: boolean }[] = [
    { module: 'PO', prefix: 'PO-', padding: 6 },
    { module: 'SO', prefix: 'SO-', padding: 6 },
    { module: 'GRN', prefix: 'GRN-', padding: 6 },
    { module: 'INVOICE', prefix: 'INV-', padding: 6 },
    { module: 'QUOTATION', prefix: 'QTN-', padding: 6 },
    { module: 'PR', prefix: 'PR-', padding: 6 },
    { module: 'DN', prefix: 'DN-', padding: 6 },
    { module: 'JOURNAL', prefix: 'JV-', padding: 6 },
    { module: 'RFQ', prefix: 'RFQ-', padding: 6 },
    { module: 'SQ', prefix: 'SQ-', padding: 6 },
    { module: 'FULFILLMENT', prefix: 'FUL-', padding: 6 },
    { module: 'PAYMENT', prefix: 'PAY-', padding: 6 },
    { module: 'TRANSFER', prefix: 'TRF-', padding: 6 },
    { module: 'RETURN', prefix: 'RET-', padding: 6 },
    { module: 'ASSET', prefix: 'FA-', padding: 5 },
  ]
  for (const s of series) {
    const ns = await prisma.numberingSeries.create({
      data: {
        companyId: company.id,
        module: s.module,
        prefix: s.prefix,
        padding: s.padding,
        resetAnnually: s.resetAnnually ?? false,
        isDefault: s.isDefault ?? true,
      },
    })
    numberingSeriesIds.push(ns.id)
  }
  console.log(` Numbering Series: ${numberingSeriesIds.length}`)

  return {
    companyId: company.id,
    branchIds,
    departmentIds,
    designationIds,
    warehouseIds,
    costCentreIds,
    fiscalYearIds: [fy.id],
    accountingPeriodIds,
    paymentTermIds,
    numberingSeriesIds,
  }
}
