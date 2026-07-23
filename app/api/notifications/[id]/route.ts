import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { apiError } from '@/lib/utils'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(apiError('Unauthorized'), { status: 401 })

  const notification = await prisma.notification.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!notification) return NextResponse.json(apiError('Not found'), { status: 404 })

  const updated = await prisma.notification.update({
    where: { id: params.id },
    data: { isRead: true, readAt: new Date() },
  })
  return NextResponse.json({ success: true, data: updated })
}
