import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { addUserIds, removeUserIds, ...groupData } = body

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(groupData).length > 0) {
        await tx.userGroup.update({ where: { id }, data: groupData })
      }
      if (addUserIds?.length) {
        await tx.userGroupMember.createMany({
          data: (addUserIds as string[]).map((userId) => ({ groupId: id, userId })),
          skipDuplicates: true,
        })
      }
      if (removeUserIds?.length) {
        await tx.userGroupMember.deleteMany({
          where: { groupId: id, userId: { in: removeUserIds as string[] } },
        })
      }
    })

    const group = await prisma.userGroup.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { members: true } },
      },
    })
    return NextResponse.json({ success: true, data: group })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  try {
    await prisma.userGroup.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
