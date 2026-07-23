import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (_req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const types = await prisma.employeeType.findMany({ orderBy: { typeName: 'asc' } })
  return NextResponse.json({ success: true, data: types })
})

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'hr')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const typeName = body.typeName?.trim()
  if (!typeName) return NextResponse.json({ success: false, error: 'typeName required' }, { status: 400 })

  try {
    const type = await prisma.employeeType.create({ data: { typeName } })
    return NextResponse.json({ success: true, data: type }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
})
