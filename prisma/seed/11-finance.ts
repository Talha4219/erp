import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'
import { pick, randFloat, randDate } from './utils'

export async function seedFinance(
  prisma: PrismaClient,
  accountIds: string[],
  accountMap: Map<string, string>,
  costCentreIds: string[],
  adminUserId: string,
): Promise<void> {
  console.log('\n--- Seeding Finance (Journal Entries, Fixed Assets) ---')

  const revenueAcctId = accountMap.get('4100')!
  const cashAcctId = accountMap.get('1101')!
  const apAcctId = accountMap.get('2101')!
  const salaryAcctId = accountMap.get('5201')!
  const rentAcctId = accountMap.get('5202')!
  const jeStart = new Date('2025-07-01')
  const jeEnd = new Date('2026-06-30')

  for (let i = 0; i < 30; i++) {
    const amount = randFloat(10000, 500000, 0)
    const desc = faker.helpers.arrayElement([
      'Monthly rent payment',
      'Utility bills payment',
      'Office supplies purchase',
      'Salary disbursement',
      'Consultancy fees',
      'Maintenance expense',
      'Travel reimbursement',
      'Marketing expense',
    ])
    const debitAcct = pick([salaryAcctId, rentAcctId, ...accountIds.filter((id) => id !== revenueAcctId)])
    const creditAcct = pick([cashAcctId, apAcctId])

    const je = await prisma.journalEntry.create({
      data: {
        entryNumber: `JV-${String(i + 1).padStart(6, '0')}`,
        date: randDate(jeStart, jeEnd),
        description: desc,
        status: 'POSTED',
        createdById: adminUserId,
        postedAt: faker.date.recent(),
      },
    })

    await prisma.journalLine.create({
      data: {
        journalId: je.id,
        debitAccountId: debitAcct,
        creditAccountId: creditAcct,
        description: desc,
        debitAmount: amount,
        creditAmount: amount,
        costCentreId: pick(costCentreIds),
      },
    })
  }

  const assetAccountId = accountMap.get('1501')!

  for (let i = 0; i < 10; i++) {
    const cost = randFloat(100000, 5000000, 0)
    const years = faker.helpers.arrayElement([3, 5, 10])
    const asset = await prisma.fixedAsset.create({
      data: {
        assetCode: `FA-${String(i + 1).padStart(5, '0')}`,
        name: faker.helpers.arrayElement([
          'CNC Cutting Machine', 'Industrial Sewing Machine', 'Forklift',
          'Generator 100kVA', 'Air Compressor', 'Packaging Machine',
          'Textile Loom', 'Boiler System', 'Office Building - Storage',
          'Delivery Truck',
        ]),
        accountId: assetAccountId,
        purchaseDate: randDate(new Date('2023-01-01'), new Date('2025-06-30')),
        purchaseCost: cost,
        residualValue: Math.round(cost * 0.1),
        usefulLifeYears: years,
        depreciationMethod: 'STRAIGHT_LINE',
        status: 'ACTIVE',
        location: pick(['Lahore Plant', 'Karachi Warehouse', 'Faisalabad Unit', 'Sialkot Facility']),
        accumulatedDepreciation: 0,
        bookValue: cost,
      },
    })

    const annualDepn = (cost - Math.round(cost * 0.1)) / years
    for (let y = 0; y < years; y++) {
      await prisma.assetDepreciation.create({
        data: {
          assetId: asset.id,
          period: `FY${2025 + y}`,
          amount: Math.round(annualDepn),
        },
      })
    }
  }

  console.log(' Journal entries: 30')
  console.log(' Fixed Assets: 10')
}
