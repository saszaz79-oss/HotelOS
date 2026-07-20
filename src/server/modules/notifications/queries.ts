import { prisma } from '@/lib/prisma';

/** Tenant isolation is implicit: userId always comes from the caller's own session, never client input — a notification row belongs to exactly one recipient. */
export async function listNotificationsForUser(userId: string, take = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { hotel: { select: { name: true } } },
  });
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
