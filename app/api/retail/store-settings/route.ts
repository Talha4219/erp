import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const GET = withAuth(async () => {
  try {
    let settings = await prisma.storeSettings.findUnique({ where: { id: 'store' } })
    if (!settings) {
      settings = await prisma.storeSettings.create({ data: { id: 'store' } })
    }
    return NextResponse.json({ success: true, data: settings })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})

export const PUT = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  try {
    const settings = await prisma.storeSettings.upsert({
      where: { id: 'store' },
      update: body,
      create: { id: 'store', ...body },
    })
    return NextResponse.json({ success: true, data: settings })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
