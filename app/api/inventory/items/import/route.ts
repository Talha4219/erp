import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nextItemSku, nextItemBarcode } from '@/lib/codes'
import { hasModuleAccess } from '@/lib/authz'
import type { Prisma } from '@prisma/client'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'inventory')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { rows } = await req.json() as { rows: Record<string, string>[] }

  const categories = await prisma.itemCategory.findMany({ select: { id: true, name: true } })
  const catMap = Object.fromEntries(categories.map((c) => [c.name.toLowerCase(), c.id]))

  const errors: string[] = []
  const validRows: Array<{ rowNum: number; data: Record<string, unknown> }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    if (!row['Item Name']) { errors.push(`Row ${rowNum}: Item Name is required`); continue }
    if (!row['UOM']) { errors.push(`Row ${rowNum}: UOM is required`); continue }

    const categoryName = row['Category'] ?? ''
    const categoryId = categoryName ? catMap[categoryName.toLowerCase()] : undefined
    if (categoryName && !categoryId) { errors.push(`Row ${rowNum}: Category "${categoryName}" not found`); continue }

    // Pre-generate SKU/barcode for rows that need them (sequential DB reads
    // but far cheaper than N× individual INSERT round trips below).
    const sku = row['SKU']?.trim() || await nextItemSku()
    const barcode = row['Barcode']?.trim() || await nextItemBarcode()

    validRows.push({
      rowNum,
      data: {
        sku, barcode, name: row['Item Name'],
        description: row['Description'] || undefined,
        uom: row['UOM'], packing: row['Packing'] || undefined,
        standardCost: parseFloat(row['Standard Cost'] ?? '0') || 0,
        sellingPrice: parseFloat(row['Selling Price'] ?? '0') || 0,
        reorderPoint: parseFloat(row['Reorder Point'] ?? '0') || 0,
        reorderQty: parseFloat(row['Reorder Qty'] ?? '0') || 0,
        ...(categoryId ? { categoryId } : {}),
      },
    })
  }

  let success = 0
  for (let i = 0; i < validRows.length; i += 100) {
    const chunk = validRows.slice(i, i + 100)
    try {
      await prisma.item.createMany({ data: chunk.map(r => r.data as Prisma.ItemCreateManyInput) })
      success += chunk.length
    } catch {
      for (const { rowNum, data } of chunk) {
        try {
          await prisma.item.create({ data: data as Prisma.ItemCreateInput })
          success++
        } catch (e2) {
          errors.push(`Row ${rowNum}: ${(e2 as Error).message.split('\n')[0]}`)
        }
      }
    }
  }

  return NextResponse.json({ success, failed: rows.length - success, errors })
}
