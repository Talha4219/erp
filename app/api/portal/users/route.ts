/**
 * Admin-side portal user management (internal ERP users only).
 * GET  /api/portal/users          — list all portal users
 * POST /api/portal/users          — create portal user (customer or supplier)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod/v4'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  type: z.enum(['CUSTOMER', 'SUPPLIER']),
  entityId: z.string(),
  phone: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.portalUser.findMany({
    where: { deletedAt: null },
    select: {
      id: true, email: true, name: true, type: true, entityId: true,
      phone: true, isActive: true, lastLoginAt: true, createdAt: true,
      _count: { select: { sessions: true } },
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json({ success: true, data: users })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { password, ...rest } = parsed.data
  const hashedPwd = await bcrypt.hash(password, 12)

  try {
    const user = await prisma.portalUser.create({
      data: { ...rest, password: hashedPwd },
      select: { id: true, email: true, name: true, type: true, entityId: true, isActive: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: user }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
