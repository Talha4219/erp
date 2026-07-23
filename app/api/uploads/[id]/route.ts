import { NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

import { auth } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasModuleAccess(session, 'documents')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const file = await prisma.uploadedFile.findUnique({ where: { id } })
  if (!file) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Length': String(file.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
