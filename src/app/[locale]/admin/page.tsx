import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { getPlatformOverview } from '@/server/modules/platform/queries';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { KpiCard, type KpiTone } from '@/components/ui/KpiCard';
import { hotelStatusTone, userStatusTone } from '@/lib/status-tone';

const KPI_ICONS: Record<string, React.ReactNode> = {
  hotelsTotal: (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path d="M4 17V4.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1V17M16 17V9a1 1 0 0 0-1-1h-2M7 7h1M10 7h1M7 10h1M10 10h1M7 13h1M10 13h1" strokeLinecap="round" />
    </svg>
  ),
  hotelsActive: (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M7 10.2 9 12l4-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  hotelsSuspended: (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M8.2 7.5v5M11.8 7.5v5" strokeLinecap="round" />
    </svg>
  ),
  usersTotal: (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="7.5" cy="7" r="2.5" />
      <path d="M2.8 16c.6-2.6 2.4-4 4.7-4s4.1 1.4 4.7 4M13 6.2a2.3 2.3 0 1 1 1.2 4.3M15.5 12.3c1.8.5 3 1.7 3.4 3.7" strokeLinecap="round" />
    </svg>
  ),
  usersActive: (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="8" cy="7" r="3" />
      <path d="M2.5 16.5c.7-3 2.7-4.7 5.5-4.7M12.5 9.5l1.5 1.5 3-3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  reportsTotal: (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path d="M6 2.5h6l3 3V17a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <path d="M7.5 10h5M7.5 13h5" strokeLinecap="round" />
    </svg>
  ),
  actionsLast24h: (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path d="M2.5 10.5h3.2l1.8-5 3 9 1.8-4h4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  activeErrors: (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path d="M10 2.5 18 16H2L10 2.5Z" strokeLinejoin="round" />
      <path d="M10 8v3.5" strokeLinecap="round" />
      <circle cx="10" cy="13.7" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
};

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export default async function AdminOverviewPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);

  const [overview, dbConnected] = await Promise.all([getPlatformOverview(), checkDatabase()]);
  const { kpis, recentHotels, recentUsers, recentAudit } = overview;
  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

  const kpiCards: { key: string; label: string; value: number; tone?: KpiTone }[] = [
    { key: 'hotelsTotal', label: dict.admin.overview.kpis.hotelsTotal, value: kpis.hotelsTotal },
    { key: 'hotelsActive', label: dict.admin.overview.kpis.hotelsActive, value: kpis.hotelsActive, tone: 'positive' },
    { key: 'hotelsSuspended', label: dict.admin.overview.kpis.hotelsSuspended, value: kpis.hotelsSuspended, tone: kpis.hotelsSuspended > 0 ? 'warning' : undefined },
    { key: 'usersTotal', label: dict.admin.overview.kpis.usersTotal, value: kpis.usersTotal },
    { key: 'usersActive', label: dict.admin.overview.kpis.usersActive, value: kpis.usersActive, tone: 'positive' },
    { key: 'reportsTotal', label: dict.admin.overview.kpis.reportsTotal, value: kpis.reportsTotal },
    { key: 'actionsLast24h', label: dict.admin.overview.kpis.actionsLast24h, value: kpis.actionsLast24h },
    { key: 'activeErrors', label: dict.admin.overview.kpis.activeErrors, value: kpis.activeErrors, tone: kpis.activeErrors > 0 ? 'critical' : 'positive' },
  ];

  const serviceRows: { label: string; value: string; ok: boolean }[] = [
    { label: dict.admin.system.database, value: dbConnected ? dict.admin.system.connected : dict.admin.system.unreachable, ok: dbConnected },
    { label: dict.admin.system.storage, value: env.STORAGE_DRIVER, ok: true },
    { label: dict.admin.system.aiProvider, value: aiConfigured ? dict.admin.system.configured : dict.admin.system.notConfigured, ok: aiConfigured },
  ];

  return (
    <div className="max-w-6xl space-y-8">
      <h1 className="text-xl font-semibold text-ink">{dict.admin.overview.title}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpiCards.map((kpi) => (
          <KpiCard key={kpi.key} label={kpi.label} value={kpi.value} tone={kpi.tone ?? 'neutral'} icon={KPI_ICONS[kpi.key]} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{dict.admin.overview.recentHotels}</CardTitle>
              <Link href={`/${locale}/admin/hotels`} className="text-xs text-accent hover:underline">
                {dict.admin.hotels.title}
              </Link>
            </CardHeader>
            {recentHotels.length === 0 ? (
              <EmptyState title={dict.admin.overview.noHotelsYet} />
            ) : (
              <ul className="divide-y divide-ink/5">
                {recentHotels.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2.5 text-sm">
                    <Link href={`/${locale}/admin/hotels/${h.id}`} className="text-ink hover:underline">
                      {h.name}
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-ink-muted">{new Date(h.createdAt).toLocaleDateString(locale)}</span>
                      <StatusBadge tone={hotelStatusTone(h.status)}>{h.status}</StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{dict.admin.overview.recentUsers}</CardTitle>
              <Link href={`/${locale}/admin/users`} className="text-xs text-accent hover:underline">
                {dict.admin.users.title}
              </Link>
            </CardHeader>
            {recentUsers.length === 0 ? (
              <EmptyState title={dict.admin.overview.noUsersYet} />
            ) : (
              <ul className="divide-y divide-ink/5">
                {recentUsers.map((u) => (
                  <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                    <Link href={`/${locale}/admin/users/${u.id}`} className="text-ink hover:underline">
                      {u.displayName}
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-ink-muted">{new Date(u.createdAt).toLocaleDateString(locale)}</span>
                      <StatusBadge tone={userStatusTone(u.status)}>{u.status}</StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{dict.admin.overview.recentAudit}</CardTitle>
              <Link href={`/${locale}/admin/audit`} className="text-xs text-accent hover:underline">
                {dict.admin.audit.title}
              </Link>
            </CardHeader>
            {recentAudit.length === 0 ? (
              <EmptyState title={dict.admin.overview.noAuditYet} />
            ) : (
              <ul className="divide-y divide-ink/5">
                {recentAudit.map((a) => (
                  <li key={a.id} className="py-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-ink">{a.action}</span>
                      <span className="text-xs text-ink-muted">{new Date(a.createdAt).toLocaleString(locale)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {a.user.displayName}
                      {a.hotel ? ` · ${a.hotel.name}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>{dict.admin.overview.serviceStatus}</CardTitle>
            <ul className="mt-3 space-y-2">
              {serviceRows.map((row) => (
                <li key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">{row.label}</span>
                  <StatusBadge tone={row.ok ? 'positive' : 'critical'}>{row.value}</StatusBadge>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle>{dict.admin.overview.quickActions}</CardTitle>
            <div className="mt-3 flex flex-col gap-2">
              <Link href={`/${locale}/admin/hotels/new`}>
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  {dict.admin.overview.actions.createHotel}
                </Button>
              </Link>
              <Link href={`/${locale}/admin/users/new`}>
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  {dict.admin.overview.actions.createUser}
                </Button>
              </Link>
              <Link href={`/${locale}/admin/feature-flags`}>
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  {dict.admin.overview.actions.manageFeatures}
                </Button>
              </Link>
              <Link href={`/${locale}/admin/audit`}>
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  {dict.admin.overview.actions.reviewAudit}
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
