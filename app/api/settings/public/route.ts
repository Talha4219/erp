import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiResponse, apiError } from '@/lib/utils'
import { cacheControl } from '@/lib/api-cache'

// Unauthenticated — used by the login page for branding. Only expose name/logo,
// never email/address/currency/etc, since this route has no session check.
export async function GET() {
  try {
    const settings = await prisma.companySettings.findFirst({ select: { name: true, logo: true } })
    return NextResponse.json(apiResponse(settings), {
      headers: { ...cacheControl(3600, 'public'), 's-maxage': '3600', 'stale-if-error': '86400' },
    })
  } catch {
    return NextResponse.json(apiError('Failed'), { status: 500 })
  }
}
