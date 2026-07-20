import { prisma } from '@/lib/prisma';
import type { NotificationType } from '@prisma/client';

interface NotificationContent {
  titleEn: string;
  titleAr: string;
  bodyEn?: string;
  bodyAr?: string;
  sourceRef?: string;
}

/** Single recipient — used when the event's audience is exactly one user (their own account, or the report's uploader). */
export async function notifyUser(userId: string, hotelId: string | null, type: NotificationType, content: NotificationContent): Promise<void> {
  await prisma.notification.create({
    data: {
      scope: hotelId ? 'hotel' : 'platform',
      hotelId,
      userId,
      type,
      titleEn: content.titleEn,
      titleAr: content.titleAr,
      bodyEn: content.bodyEn,
      bodyAr: content.bodyAr,
      sourceRef: content.sourceRef,
    },
  });
}

/** Fans out to every active member of the hotel — one row per recipient (hotel_suspended, feature_toggled, kpi_warning). */
export async function notifyHotelMembers(hotelId: string, type: NotificationType, content: NotificationContent): Promise<void> {
  const members = await prisma.hotelMembership.findMany({
    where: { hotelId, status: 'active' },
    select: { userId: true },
  });
  if (members.length === 0) return;
  await prisma.notification.createMany({
    data: members.map((m) => ({
      scope: 'hotel' as const,
      hotelId,
      userId: m.userId,
      type,
      titleEn: content.titleEn,
      titleAr: content.titleAr,
      bodyEn: content.bodyEn,
      bodyAr: content.bodyAr,
      sourceRef: content.sourceRef,
    })),
  });
}

/** Fans out to every Platform Owner account — platform-scoped events (currently unused by v1 triggers, reserved for future platform-level notices). */
export async function notifyPlatformOwners(type: NotificationType, content: NotificationContent): Promise<void> {
  const owners = await prisma.user.findMany({ where: { isSuperAdmin: true, status: 'active' }, select: { id: true } });
  if (owners.length === 0) return;
  await prisma.notification.createMany({
    data: owners.map((o) => ({
      scope: 'platform' as const,
      hotelId: null,
      userId: o.id,
      type,
      titleEn: content.titleEn,
      titleAr: content.titleAr,
      bodyEn: content.bodyEn,
      bodyAr: content.bodyAr,
      sourceRef: content.sourceRef,
    })),
  });
}

/** Ownership check is implicit in the where clause — updating 0 rows for a notification that isn't the caller's own is a silent no-op, not an error, matching this codebase's redirect-not-throw discipline for cross-tenant edge cases. */
export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
