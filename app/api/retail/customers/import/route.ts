import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const POST = withAuth(async (req: NextRequest) => {
  const { rows } = await req.json()
  let success = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const firstName = row['First Name']?.trim()
      const lastName = row['Last Name']?.trim()
      const email = row['Email']?.trim()

      if (!firstName || !lastName || !email) {
        errors.push(`Row ${i + 1}: First Name, Last Name, and Email are required`)
        continue
      }

      const existing = await prisma.retailCustomer.findUnique({ where: { email } })
      if (existing) {
        errors.push(`Row ${i + 1}: Email ${email} already exists`)
        continue
      }

      const dobRaw = row['Date of Birth (YYYY-MM-DD)']?.trim()
      const gdprRaw = row['GDPR Consent Date (YYYY-MM-DD)']?.trim()

      await prisma.retailCustomer.create({
        data: {
          title: row['Title']?.trim() || null,
          firstName,
          lastName,
          email,
          phone: row['Phone']?.trim() || null,
          dateOfBirth: dobRaw ? new Date(dobRaw) : null,
          marketingOptIn: row['Marketing Opt-In (TRUE/FALSE)']?.trim().toUpperCase() === 'TRUE',
          gdprConsentDate: gdprRaw ? new Date(gdprRaw) : null,
        },
      })
      success++
    } catch (err) {
      errors.push(`Row ${i + 1}: ${(err as Error).message}`)
    }
  }

  return NextResponse.json({ success: true, data: { success, failed: rows.length - success, errors } })
})
