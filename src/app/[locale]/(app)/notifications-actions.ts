'use server';

import { getCurrentUser } from '@/server/modules/auth/session';
import { listNotificationsForUser, countUnreadNotifications } from '@/server/modules/notifications/queries';
import { markNotificationRead, markAllNotificationsRead } from '@/server/modules/notifications/commands';

export interface NotificationListItem {
  id: string;
  type: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string | null;
  bodyAr: string | null;
  hotelName: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function fetchNotificationsAction(): Promise<{ items: NotificationListItem[]; unreadCount: number }> {
  const user = await getCurrentUser();
  if (!user) return { items: [], unreadCount: 0 };

  const [rows, unreadCount] = await Promise.all([listNotificationsForUser(user.id), countUnreadNotifications(user.id)]);
  return {
    items: rows.map((n) => ({
      id: n.id,
      type: n.type,
      titleEn: n.titleEn,
      titleAr: n.titleAr,
      bodyEn: n.bodyEn,
      bodyAr: n.bodyAr,
      hotelName: n.hotel?.name ?? null,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  };
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await markNotificationRead(user.id, notificationId);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await markAllNotificationsRead(user.id);
}
