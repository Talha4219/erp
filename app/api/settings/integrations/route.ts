import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DEFAULT_INTEGRATIONS = [
  { key: 'sms', name: 'SMS Gateway' },
  { key: 'whatsapp', name: 'WhatsApp API' },
  { key: 'payment_gateway', name: 'Payment Gateway' },
]

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const existing = await prisma.integrationConfig.findMany({ orderBy: { key: 'asc' } })
    const existingKeys = new Set(existing.map((i) => i.key))
    const missing = DEFAULT_INTEGRATIONS.filter((d) => !existingKeys.has(d.key))
    const data = [
      ...existing,
      ...missing.map((d) => ({ id: null, key: d.key, name: d.name, isConnected: false, config: null, lastSyncAt: null, updatedAt: null })),
    ].sort((a, b) => a.key.localeCompare(b.key))
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { key, name, isConnected, config } = body
    if (!key) return NextResponse.json({ success: false, error: 'key required' }, { status: 400 })

    const updated = await prisma.integrationConfig.upsert({
      where: { key },
      update: { name, isConnected, config, lastSyncAt: isConnected ? new Date() : undefined },
      create: { key, name, isConnected: !!isConnected, config, lastSyncAt: isConnected ? new Date() : undefined },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
