import { cache } from 'react';
import { prisma } from '@/lib/prisma';

/** Tenant isolation is implicit: userId always comes from the caller's own session, never client input — a notification row belongs to exactly one recipient. */
export const listNotificationsForUser = cache(async (userId: string, take = 20) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { hotel: { select: { name: true } } },
  });
});

export const countUnreadNotifications = cache(async (userId: string): Promise<number> => {
  return prisma.notification.count({ where: { userId, readAt: null } });
});
