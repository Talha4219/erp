import prisma from '@/lib/prisma'
import type { NotificationType, NotificationChannel } from '@prisma/client'

type CreateNotificationInput = {
  userId: string
  title: string
  body: string
  type?: NotificationType
  channel?: NotificationChannel
  entityType?: string
  entityId?: string
  actionUrl?: string
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type ?? 'INFO',
      channel: input.channel ?? 'IN_APP',
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl,
    },
  })
}

export async function notifyUsers(userIds: string[], input: Omit<CreateNotificationInput, 'userId'>) {
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: input.title,
      body: input.body,
      type: input.type ?? 'INFO',
      channel: input.channel ?? 'IN_APP',
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl,
    })),
  })
}

export async function notifyRole(role: string, input: Omit<CreateNotificationInput, 'userId'>) {
  const users = await prisma.user.findMany({
    where: { role: role as never, isActive: true, deletedAt: null },
    select: { id: true },
  })
  if (!users.length) return
  return notifyUsers(users.map((u) => u.id), input)
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } })
}
