import { prisma } from '@/lib/prisma';

interface OverviewCountsRow {
  hotelsTotal: number;
  hotelsActive: number;
  hotelsSuspended: number;
  usersTotal: number;
  usersActive: number;
  reportsTotal: number;
  actionsLast24h: number;
  activeErrors: number;
}

/**
 * Platform Owner Overview — CQRS reads only (Architecture §28). The 8 KPI
 * counts are one round trip (subquery aggregates, cast to int since raw
 * COUNT(*) comes back as bigint) instead of 8 separate `Promise.all`'d
 * queries — Promise.all only parallelizes at the application-code level;
 * under the pool's serverless-safe `max: 1` connection cap (src/lib/prisma.ts)
 * those 8 "concurrent" queries were still executing one at a time against
 * the single pooled connection, so merging them into one query is a real
 * round-trip reduction, not just a code-style change (Perf sprint, M14).
 * Every number still comes from a real table; "active system errors" is
 * ReportUpload.status='error' — the one persisted signal for "something is
 * currently broken and unresolved" this schema actually has, not a
 * fabricated health metric.
 */
export async function getPlatformOverview() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [[counts], recentHotels, recentUsers, recentAudit] = await Promise.all([
    prisma.$queryRaw<OverviewCountsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "Hotel")::int AS "hotelsTotal",
        (SELECT COUNT(*) FROM "Hotel" WHERE status = 'active')::int AS "hotelsActive",
        (SELECT COUNT(*) FROM "Hotel" WHERE status = 'suspended')::int AS "hotelsSuspended",
        (SELECT COUNT(*) FROM "User" WHERE "isSuperAdmin" = false)::int AS "usersTotal",
        (SELECT COUNT(*) FROM "User" WHERE "isSuperAdmin" = false AND status = 'active')::int AS "usersActive",
        (SELECT COUNT(*) FROM "ReportUpload")::int AS "reportsTotal",
        (SELECT COUNT(*) FROM "AuditLog" WHERE "createdAt" >= ${oneDayAgo})::int AS "actionsLast24h",
        (SELECT COUNT(*) FROM "ReportUpload" WHERE status = 'error')::int AS "activeErrors"
    `,
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

  // A single-row aggregate SELECT (no FROM/WHERE on the outer query) always
  // returns exactly one row — the array-typed return of $queryRaw is what
  // makes TS treat `counts` as possibly undefined, not any real runtime path.
  if (!counts) throw new Error('getPlatformOverview: aggregate query returned no rows');

  return {
    kpis: counts,
    recentHotels,
    recentUsers,
    recentAudit,
  };
}
