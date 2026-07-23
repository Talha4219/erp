import { PrismaClient } from '@prisma/client'

export async function seedTaxRates(prisma: PrismaClient): Promise<void> {
  console.log('\n--- Seeding Tax Rates ---')

  await prisma.taxRate.createMany({
    data: [
      { code: 'STD', name: 'Standard Sales Tax', taxType: 'SALES_TAX', rate: 0, isDefault: true },
      { code: 'SRB-0', name: 'Sindh SRB - Zero Rated', taxType: 'SALES_TAX', rate: 0 },
      { code: 'WHT', name: 'Withholding Tax', taxType: 'WITHHOLDING', rate: 0 },
      { code: 'EXEMPT', name: 'Tax Exempt', taxType: 'EXEMPT', rate: 0 },
    ],
    skipDuplicates: true,
  })
  console.log(' Tax rates seeded')
}

export async function seedCurrencies(prisma: PrismaClient): Promise<void> {
  console.log('\n--- Seeding Currencies ---')

  await prisma.currency.createMany({
    data: [
      { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', exchangeRate: 1, isBase: true },
      { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 278.5, isBase: false },
      { code: 'GBP', name: 'Pound Sterling', symbol: '£', exchangeRate: 350.25, isBase: false },
      { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 302.75, isBase: false },
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', exchangeRate: 75.8, isBase: false },
      { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', exchangeRate: 74.2, isBase: false },
    ],
    skipDuplicates: true,
  })
  console.log(' Currencies seeded')
}

export async function seedPriceLists(
  prisma: PrismaClient,
  itemIds: string[],
): Promise<void> {
  console.log('\n--- Seeding Price Lists ---')

  const pl = await prisma.priceList.create({
    data: {
      code: 'PKR-RETAIL',
      name: 'Pakistan Retail Price List',
      currency: 'PKR',
      isDefault: true,
      isActive: true,
      description: 'Standard retail prices in Pakistani Rupees',
    },
  })

  const batchSize = 50
  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize)
    await Promise.all(
      batch.map((itemId) =>
        prisma.priceListItem.create({
          data: {
            priceListId: pl.id,
            itemId,
            description: 'Standard retail price',
            unitPrice: Math.floor(Math.random() * 100000) + 100,
          },
        }),
      ),
    )
  }
  console.log(` Price List with ${itemIds.length} items`)
}
