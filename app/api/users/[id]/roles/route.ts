import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invalidatePermCache } from '@/lib/middleware/permission'
import { z } from 'zod/v4'

type Params = Promise<{ id: string }>

const assignSchema = z.object({
  customRoleId: z.string(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const roles = await prisma.userRole.findMany({
    where: { userId: id },
    include: {
      customRole: {
        include: { permissions: { include: { permission: true } } },
      },
    },
    orderBy: { customRole: { name: 'asc' } },
  })
  return NextResponse.json({ success: true, data: roles })
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { customRoleId, branchId, departmentId, validFrom, validTo } = parsed.data

  try {
    const userRole = await prisma.userRole.create({
      data: {
        userId: id,
        customRoleId,
        branchId,
        departmentId,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validTo: validTo ? new Date(validTo) : undefined,
      },
      include: { customRole: { include: { permissions: { include: { permission: true } } } } },
    })
    invalidatePermCache(id)
    return NextResponse.json({ success: true, data: userRole }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { userRoleId } = await req.json()
  if (!userRoleId) {
    return NextResponse.json({ success: false, error: 'userRoleId required' }, { status: 400 })
  }

  try {
    await prisma.userRole.delete({ where: { id: userRoleId, userId: id } })
    invalidatePermCache(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
