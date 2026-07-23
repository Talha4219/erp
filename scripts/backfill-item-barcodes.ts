// One-off backfill: assign an internal EAN-13-style barcode to every item that
// doesn't have one yet. Safe to re-run — only touches items with barcode = null.
// Run: npx tsx scripts/backfill-item-barcodes.ts
import { prisma } from '../lib/prisma'
import { nextItemBarcode } from '../lib/codes'

async function main() {
  const items = await prisma.item.findMany({
    where: { barcode: null },
    select: { id: true, sku: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
  for (const item of items) {
    const barcode = await nextItemBarcode()
    await prisma.item.update({ where: { id: item.id }, data: { barcode } })
    console.log(`${item.sku}  ${barcode}  ${item.name}`)
  }
  console.log(`\nAssigned barcodes to ${items.length} item(s)`)
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
