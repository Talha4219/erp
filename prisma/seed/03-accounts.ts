import { PrismaClient } from '@prisma/client'

const ACCOUNTS: { code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'; parentCode?: string }[] = [
  // ASSETS (1xxx)
  { code: '1000', name: 'Current Assets', type: 'ASSET' },
  { code: '1100', name: 'Cash & Bank', type: 'ASSET', parentCode: '1000' },
  { code: '1101', name: 'Cash on Hand', type: 'ASSET', parentCode: '1100' },
  { code: '1102', name: 'HBL Current Account', type: 'ASSET', parentCode: '1100' },
  { code: '1103', name: 'UBL Current Account', type: 'ASSET', parentCode: '1100' },
  { code: '1104', name: 'Meezan Bank Account', type: 'ASSET', parentCode: '1100' },
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1000' },
  { code: '1201', name: 'Trade Debtors', type: 'ASSET', parentCode: '1200' },
  { code: '1300', name: 'Inventory', type: 'ASSET', parentCode: '1000' },
  { code: '1301', name: 'Raw Materials Inventory', type: 'ASSET', parentCode: '1300' },
  { code: '1302', name: 'Finished Goods Inventory', type: 'ASSET', parentCode: '1300' },
  { code: '1303', name: 'Packing Materials Inventory', type: 'ASSET', parentCode: '1300' },
  { code: '1400', name: 'Prepayments & Advances', type: 'ASSET', parentCode: '1000' },
  { code: '1401', name: 'Advance to Suppliers', type: 'ASSET', parentCode: '1400' },
  { code: '1500', name: 'Non-Current Assets', type: 'ASSET' },
  { code: '1501', name: 'Property, Plant & Equipment', type: 'ASSET', parentCode: '1500' },
  { code: '1502', name: 'Furniture & Fixtures', type: 'ASSET', parentCode: '1500' },
  { code: '1503', name: 'Office Equipment', type: 'ASSET', parentCode: '1500' },
  { code: '1504', name: 'Vehicles', type: 'ASSET', parentCode: '1500' },
  { code: '1505', name: 'Accumulated Depreciation', type: 'ASSET', parentCode: '1500' },

  // LIABILITIES (2xxx)
  { code: '2000', name: 'Current Liabilities', type: 'LIABILITY' },
  { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2101', name: 'Trade Creditors', type: 'LIABILITY', parentCode: '2100' },
  { code: '2200', name: 'Tax Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2201', name: 'Sales Tax Payable', type: 'LIABILITY', parentCode: '2200' },
  { code: '2202', name: 'Income Tax Payable', type: 'LIABILITY', parentCode: '2200' },
  { code: '2300', name: 'Accrued Expenses', type: 'LIABILITY', parentCode: '2000' },
  { code: '2301', name: 'Salaries Payable', type: 'LIABILITY', parentCode: '2300' },
  { code: '2500', name: 'Non-Current Liabilities', type: 'LIABILITY' },
  { code: '2501', name: 'Bank Loans - Long Term', type: 'LIABILITY', parentCode: '2500' },
  { code: '2502', name: 'Directors Loan', type: 'LIABILITY', parentCode: '2500' },

  // EQUITY (3xxx)
  { code: '3000', name: 'Equity', type: 'EQUITY' },
  { code: '3100', name: 'Share Capital', type: 'EQUITY', parentCode: '3000' },
  { code: '3200', name: 'Retained Earnings', type: 'EQUITY', parentCode: '3000' },
  { code: '3300', name: 'Current Year Profit/Loss', type: 'EQUITY', parentCode: '3000' },

  // REVENUE (4xxx)
  { code: '4000', name: 'Revenue', type: 'REVENUE' },
  { code: '4100', name: 'Sales Revenue', type: 'REVENUE', parentCode: '4000' },
  { code: '4101', name: 'Textile Sales', type: 'REVENUE', parentCode: '4100' },
  { code: '4102', name: 'Garments Sales', type: 'REVENUE', parentCode: '4100' },
  { code: '4103', name: 'Electronics Sales', type: 'REVENUE', parentCode: '4100' },
  { code: '4104', name: 'Food Products Sales', type: 'REVENUE', parentCode: '4100' },
  { code: '4200', name: 'Other Income', type: 'REVENUE', parentCode: '4000' },
  { code: '4201', name: 'Discount Received', type: 'REVENUE', parentCode: '4200' },
  { code: '4202', name: 'Interest Income', type: 'REVENUE', parentCode: '4200' },

  // EXPENSES (5xxx)
  { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
  { code: '5100', name: 'Direct Material Cost', type: 'EXPENSE', parentCode: '5000' },
  { code: '5101', name: 'Raw Material Consumed', type: 'EXPENSE', parentCode: '5100' },
  { code: '5102', name: 'Packing Material Consumed', type: 'EXPENSE', parentCode: '5100' },
  { code: '5200', name: 'Operating Expenses', type: 'EXPENSE' },
  { code: '5201', name: 'Salaries & Wages', type: 'EXPENSE', parentCode: '5200' },
  { code: '5202', name: 'Rent & Utilities', type: 'EXPENSE', parentCode: '5200' },
  { code: '5203', name: 'Office Supplies', type: 'EXPENSE', parentCode: '5200' },
  { code: '5204', name: 'Travel & Conveyance', type: 'EXPENSE', parentCode: '5200' },
  { code: '5205', name: 'Communication Expenses', type: 'EXPENSE', parentCode: '5200' },
  { code: '5206', name: 'Electricity & Gas', type: 'EXPENSE', parentCode: '5200' },
  { code: '5207', name: 'Depreciation Expense', type: 'EXPENSE', parentCode: '5200' },
  { code: '5300', name: 'Financial Charges', type: 'EXPENSE' },
  { code: '5301', name: 'Bank Charges', type: 'EXPENSE', parentCode: '5300' },
  { code: '5302', name: 'Interest Expense', type: 'EXPENSE', parentCode: '5300' },
  { code: '5400', name: 'Tax Expense', type: 'EXPENSE' },
  { code: '5401', name: 'Income Tax Expense', type: 'EXPENSE', parentCode: '5400' },
  { code: '5402', name: 'Sales Tax Expense', type: 'EXPENSE', parentCode: '5400' },
]

export async function seedAccounts(prisma: PrismaClient): Promise<{ accountIds: string[]; accountMap: Map<string, string> }> {
  console.log('\n--- Seeding Chart of Accounts ---')

  const accountMap = new Map<string, string>()
  const createdIds: string[] = []

  for (const a of ACCOUNTS) {
    const parentId = a.parentCode ? accountMap.get(a.parentCode) : undefined
    const acct = await prisma.account.create({
      data: {
        code: a.code,
        name: a.name,
        type: a.type,
        parentId,
      },
    })
    accountMap.set(a.code, acct.id)
    createdIds.push(acct.id)
  }

  console.log(` Accounts: ${createdIds.length}`)
  return { accountIds: createdIds, accountMap }
}
