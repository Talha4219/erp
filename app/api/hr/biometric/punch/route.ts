import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Webhook endpoint for biometric devices to push punches. Devices aren't logged-in
// users, so this checks a shared secret header instead of a session.
// Devices POST: { deviceCode, rawUserId, punchTime, punchType }
export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-device-secret')
    if (!secret || secret !== process.env.BIOMETRIC_WEBHOOK_SECRET) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { deviceCode, rawUserId, punchTime, punchType = 'UNKNOWN' } = body

    const device = await prisma.biometricDevice.findUnique({ where: { deviceCode } })
    if (!device || !device.isActive) {
      return NextResponse.json({ success: false, error: 'Device not found or inactive' }, { status: 404 })
    }

    // Try to match employee by employeeCode (rawUserId convention: same as employeeCode)
    const employee = await prisma.employee.findUnique({ where: { employeeCode: rawUserId } })

    const log = await prisma.biometricLog.create({
      data: {
        deviceId: device.id,
        rawUserId,
        employeeId: employee?.id ?? null,
        punchTime: new Date(punchTime),
        punchType,
        processed: false,
      },
    })

    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: { lastSyncAt: new Date() },
    })

    return NextResponse.json({ success: true, data: { logId: log.id } }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
