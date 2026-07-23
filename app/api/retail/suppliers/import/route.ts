import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModuleAccess } from '@/lib/authz'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'procurement')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { rows } = await req.json() as { rows: Record<string, string>[] }

  const errors: string[] = []
  const validRows: Array<{
    companyName: string; contactPerson: string | null; email: string | null
    phone: string | null; paymentTerms: string | null; leadTimeDays: number
    performanceRating: number; bankSortCode: string | null
    bankAccountNumber: string | null; isActive: boolean
  }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    if (!row['Company Name']) { errors.push(`Row ${rowNum}: Company Name is required`); continue }
    validRows.push({
      companyName: row['Company Name'],
      contactPerson: row['Contact Person'] || null,
      email: row['Email'] || null,
      phone: row['Phone'] || null,
      paymentTerms: row['Payment Terms'] || null,
      leadTimeDays: parseInt(row['Lead Time (Days)'] ?? '7') || 7,
      performanceRating: parseInt(row['Performance Rating'] ?? '3') || 3,
      bankSortCode: row['Bank Sort Code'] || null,
      bankAccountNumber: row['Bank Account Number'] || null,
      isActive: (row['Is Active'] ?? 'TRUE').toUpperCase() !== 'FALSE',
    })
  }

  let success = 0
  for (let i = 0; i < validRows.length; i += 100) {
    const chunk = validRows.slice(i, i + 100)
    try {
      await prisma.supplier.createMany({ data: chunk })
      success += chunk.length
    } catch {
      for (const row of chunk) {
        try {
          await prisma.supplier.create({ data: row })
          success++
        } catch (e2) {
          errors.push(`Row ${rows.findIndex(r => r['Company Name'] === row.companyName) + 2}: ${(e2 as Error).message.split('\n')[0]}`)
        }
      }
    }
  }

  return NextResponse.json({ success, failed: rows.length - success, errors })
}
