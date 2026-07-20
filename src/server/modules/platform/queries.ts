import { prisma } from '@/lib/prisma';

/**
 * Platform Owner Overview — CQRS reads only (Architecture §28), all
 * aggregate counts computed with Promise.all in one round-trip batch
 * rather than sequentially (M7 performance discipline). Every number here
 * comes from a real table; "active system errors" is
 * ReportUpload.status='error' — the one persisted signal for "something is
 * currently broken and unresolved" this schema actually has, not a
 * fabricated health metric.
 */
export async function getPlatformOverview() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    hotelsTotal,
    hotelsActive,
    hotelsSuspended,
    usersTotal,
    usersActive,
    reportsTotal,
    actionsLast24h,
    activeErrors,
    recentHotels,
    recentUsers,
    recentAudit,
  ] = await Promise.all([
    prisma.hotel.count(),
    prisma.hotel.count({ where: { status: 'active' } }),
    prisma.hotel.count({ where: { status: 'suspended' } }),
    prisma.user.count({ where: { isSuperAdmin: false } }),
    prisma.user.count({ where: { isSuperAdmin: false, status: 'active' } }),
    prisma.reportUpload.count(),
    prisma.auditLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.reportUpload.count({ where: { status: 'error' } }),
    prisma.hotel.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, status: true, createdAt: true } }),
    prisma.user.findMany({
      where: { isSuperAdmin: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, username: true, displayName: true, status: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { user: { select: { displayName: true } }, hotel: { select: { name: true } } },
    }),
  ]);

  return {
    kpis: {
      hotelsTotal,
      hotelsActive,
      hotelsSuspended,
      usersTotal,
      usersActive,
      reportsTotal,
      actionsLast24h,
      activeErrors,
    },
    recentHotels,
    recentUsers,
    recentAudit,
  };
}
