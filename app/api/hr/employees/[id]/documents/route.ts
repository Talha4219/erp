import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthedSession } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (_req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const docs = await prisma.employeeDocument.findMany({
    where: { employeeId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ success: true, data: docs })
})

export const POST = withAuth(async (req: NextRequest, { params, session }: { params: { id: string } } & { session: AuthedSession }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: params.id,
        uploadedById: session.user?.id,
        docType: body.docType ?? 'OTHER',
        title: body.title,
        fileUrl: body.fileUrl,
        fileSize: body.fileSize,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        notes: body.notes,
      },
    })
    return NextResponse.json({ success: true, data: doc }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
