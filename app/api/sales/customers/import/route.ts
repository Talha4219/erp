import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiErrorResponse } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'

const TEMPLATE_COLUMNS = [
  'Customer Code', 'Customer Name', 'Contact Person', 'Email', 'Phone',
  'Address', 'City', 'Country', 'Tax ID', 'Credit Limit', 'Payment Terms (Days)',
]

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'sales'))
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ success: true, columns: TEMPLATE_COLUMNS })
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasModuleAccess(session, 'sales'))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const { rows } = await req.json() as { rows: Record<string, string>[] }

    const errors: string[] = []
    const validRows: Array<{
      customerCode: string; name: string; contactPerson: string | null
      email: string | null; phone: string | null; address: string | null
      city: string | null; country: string | null; taxId: string | null
      creditLimit: number; paymentTerms: number
    }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      if (!row['Customer Code']) { errors.push(`Row ${rowNum}: Customer Code is required`); continue }
      if (!row['Customer Name']) { errors.push(`Row ${rowNum}: Customer Name is required`); continue }
      validRows.push({
        customerCode: row['Customer Code'],
        name: row['Customer Name'],
        contactPerson: row['Contact Person'] || null,
        email: row['Email'] || null,
        phone: row['Phone'] || null,
        address: row['Address'] || null,
        city: row['City'] || null,
        country: row['Country'] || null,
        taxId: row['Tax ID'] || null,
        creditLimit: parseFloat(row['Credit Limit'] ?? '0') || 0,
        paymentTerms: parseInt(row['Payment Terms (Days)'] ?? '30') || 30,
      })
    }

    let success = 0
    for (let i = 0; i < validRows.length; i += 100) {
      const chunk = validRows.slice(i, i + 100)
      try {
        await prisma.customer.createMany({ data: chunk })
        success += chunk.length
      } catch {
        // Fallback: insert one-by-one to isolate failing rows
        for (const row of chunk) {
          try {
            await prisma.customer.create({ data: row })
            success++
          } catch (e2) {
            errors.push(`Row ${rows.findIndex(r => r['Customer Code'] === row.customerCode) + 2}: ${(e2 as Error).message.split('\n')[0]}`)
          }
        }
      }
    }

    return NextResponse.json({ success, failed: rows.length - success, errors })
  } catch (err) {
    return apiErrorResponse(err)
  }
}
