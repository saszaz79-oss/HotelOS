import Link from 'next/link';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { getPlatformOverview } from '@/server/modules/platform/queries';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { hotelStatusTone, userStatusTone } from '@/lib/status-tone';

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

  const kpiCards: { label: string; value: number; tone?: StatusTone }[] = [
    { label: dict.admin.overview.kpis.hotelsTotal, value: kpis.hotelsTotal },
    { label: dict.admin.overview.kpis.hotelsActive, value: kpis.hotelsActive, tone: 'positive' },
    { label: dict.admin.overview.kpis.hotelsSuspended, value: kpis.hotelsSuspended, tone: kpis.hotelsSuspended > 0 ? 'warning' : undefined },
    { label: dict.admin.overview.kpis.usersTotal, value: kpis.usersTotal },
    { label: dict.admin.overview.kpis.usersActive, value: kpis.usersActive, tone: 'positive' },
    { label: dict.admin.overview.kpis.reportsTotal, value: kpis.reportsTotal },
    { label: dict.admin.overview.kpis.actionsLast24h, value: kpis.actionsLast24h },
    { label: dict.admin.overview.kpis.activeErrors, value: kpis.activeErrors, tone: kpis.activeErrors > 0 ? 'critical' : 'positive' },
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
          <Card key={kpi.label} className="p-4">
            <p className="text-xs text-ink-muted">{kpi.label}</p>
            <p
              className={
                'metric-value mt-1 text-2xl font-semibold ' +
                (kpi.tone === 'critical'
                  ? 'text-status-critical'
                  : kpi.tone === 'warning'
                  ? 'text-status-warning'
                  : 'text-ink')
              }
            >
              {kpi.value}
            </p>
          </Card>
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
