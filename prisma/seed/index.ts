import { PrismaClient } from '@prisma/client'
import { clearDatabase } from './clear'
import { seedCompany } from './01-company'
import { seedUsers } from './02-users'
import { seedAccounts } from './03-accounts'
import { seedItems } from './04-items'
import { seedVendors, seedCustomers } from './05-vendors-customers'
import { seedTaxRates, seedCurrencies, seedPriceLists } from './06-taxes-prices'
import { seedPurchases } from './07-purchases'
import { seedStock } from './08-stock'
import { seedSales } from './09-sales'
import { seedHR } from './10-hr'
import { seedFinance } from './11-finance'
import { seedRoles } from './12-roles'

async function main() {
  console.log('========================================')
  console.log('   PAKISTAN ENTERPRISE ERP DATA SEED')
  console.log('========================================')

  const prisma = new PrismaClient()

  try {
    await clearDatabase(prisma)

    const company = await seedCompany(prisma)
    const users = await seedUsers(
      prisma,
      company.departmentIds,
      company.designationIds,
      company.branchIds,
      company.companyId,
    )
    const accounts = await seedAccounts(prisma)
    const items = await seedItems(prisma)
    const vendors = await seedVendors(prisma)
    const customers = await seedCustomers(prisma)
    await seedTaxRates(prisma)
    await seedCurrencies(prisma)
    await seedPriceLists(prisma, items.itemIds)

    const purchases = await seedPurchases(
      prisma,
      vendors.vendorIdsByIndex,
      items.itemIds,
      company.warehouseIds,
      company.companyId,
      users.userIds,
    )
    await seedStock(prisma, purchases.grnLineItemData)

    await seedSales(prisma, customers.customerIdsByIndex, items.itemIds, company.companyId)

    await seedHR(prisma, users.employeeIds)
    await seedFinance(prisma, accounts.accountIds, accounts.accountMap, company.costCentreIds, users.adminUserId)
    await seedRoles(prisma, company.companyId, users.userIds)

    console.log('\n========================================')
    console.log('   SEED COMPLETED SUCCESSFULLY')
    console.log('========================================')
  } catch (error) {
    console.error('\n❌ Seed failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
