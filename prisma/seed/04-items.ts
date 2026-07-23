import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'
import { generateProductSKU } from './utils'
import { ITEMS, ITEM_CATEGORIES } from './constants'

export async function seedItems(prisma: PrismaClient): Promise<{
  catIds: string[]
  itemIds: string[]
  itemMap: Map<string, string>
}> {
  console.log('\n--- Seeding Item Categories & Items ---')

  const catMap = new Map<string, string>()
  const catIds: string[] = []
  const parentCats = [...new Set(ITEM_CATEGORIES.map((c) => c.parent))]
  for (const p of parentCats) {
    const existing = await prisma.itemCategory.findFirst({ where: { name: p } })
    if (!existing) {
      const cat = await prisma.itemCategory.create({
        data: { name: p, code: p.slice(0, 4).toUpperCase(), description: `${p} Category` },
      })
      catMap.set(p, cat.id)
      catIds.push(cat.id)
    } else {
      catMap.set(p, existing.id)
      catIds.push(existing.id)
    }
  }

  for (const c of ITEM_CATEGORIES) {
    const existing = await prisma.itemCategory.findFirst({ where: { name: c.name } })
    if (!existing) {
      const parentId = catMap.get(c.parent) || undefined
      const cat = await prisma.itemCategory.create({
        data: { name: c.name, code: c.code, parentId, description: `${c.name}` },
      })
      catMap.set(c.name, cat.id)
      catIds.push(cat.id)
    } else {
      catMap.set(c.name, existing.id)
      catIds.push(existing.id)
    }
  }
  console.log(` Categories: ${catIds.length}`)

  const itemMap = new Map<string, string>()
  const itemIds: string[] = []

  for (let i = 0; i < ITEMS.length; i++) {
    const it = ITEMS[i]
    const sku = generateProductSKU(it.category, i + 1)
    const categoryId = catMap.get(it.category) || catIds[0]

    const item = await prisma.item.create({
      data: {
        sku,
        barcode: faker.string.numeric(12),
        name: it.name,
        categoryId,
        uom: it.uom,
        reorderPoint: 10,
        reorderQty: 50,
        standardCost: Math.round(it.price * 0.65),
        sellingPrice: it.price,
        vatRate: it.vat,
        isActive: true,
        isSellable: true,
        isPurchasable: true,
      },
    })
    itemMap.set(it.name, item.id)
    itemIds.push(item.id)
  }

  console.log(` Items: ${itemIds.length}`)
  return { catIds, itemIds, itemMap }
}
