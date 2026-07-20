import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { getLatestMetricDate, getMetricsForDate, getPreviousMetricDate } from '@/server/modules/metrics/queries';
import { getLatestInsight } from '@/server/modules/insights/queries';
import { buildMorningBrief } from '@/server/modules/insights/morning-brief';
import { generateExecutiveSummary } from '@/server/modules/ai-orchestration/commands';
import { listReportUploads } from '@/server/modules/reports/queries';
import { formatMetricValue } from '@/lib/format-metric';
import type { HealthFactor } from '@/server/modules/insights/scoring';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { reportStatusTone } from '@/lib/status-tone';

const KEY_METRIC_KEYS = [
  'occupancy_pct',
  'adr',
  'revpar',
  'room_revenue',
  'total_revenue',
  'rooms_sold',
  'rooms_available',
  'cancellations',
  'no_shows',
];

function dataQualityTone(score: number): 'positive' | 'warning' | 'critical' {
  if (score >= 0.8) return 'positive';
  if (score >= 0.5) return 'warning';
  return 'critical';
}

export default async function MissionControlPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  // Mission Control is hotel-scoped. The Platform Owner (isSuperAdmin) never
  // has a HotelMembership by design (cross-hotel, not a normal hotel user —
  // same fact (app)/layout.tsx already encodes). Sending them further into
  // this hotel-scoped page crashed on the non-null assertion below (Vercel
  // runtime digest 1120167232: TypeError reading 'hotelId' on null); their
  // real landing page is the Super Admin Console.
  if (user?.isSuperAdmin) {
    redirect(`/${locale}/admin`);
  }

  const membership = user ? await getActiveMembership(user.id) : null;

  if (!membership) {
    return (
      <div className="max-w-lg">
        <p className="text-ink-muted">{dict.missionControl.noHotels}</p>
      </div>
    );
  }

  const hotelId = membership.hotelId;
  const hasAnyUpload = (await prisma.reportUpload.count({ where: { hotelId } })) > 0;
  const latestDate = await getLatestMetricDate(hotelId);

  if (!latestDate) {
    return (
      <div className="max-w-3xl space-y-6">
        <h1 className="text-2xl font-medium text-ink">
          {dict.missionControl.greeting}, {user?.displayName}
        </h1>
        <EmptyState
          title={hasAnyUpload ? dict.missionControl.notFinalized : dict.missionControl.noReports}
          action={
            !hasAnyUpload ? (
              <Link href={`/${locale}/reports/upload`}>
                <Button>{dict.missionControl.uploadCta}</Button>
              </Link>
            ) : (
              <Link href={`/${locale}/reports/archive`}>
                <Button variant="secondary">{dict.missionControl.viewArchive}</Button>
              </Link>
            )
          }
        />
      </div>
    );
  }

  const [metrics, previousDate, insight, aiSummary, recentUploads] = await Promise.all([
    getMetricsForDate(hotelId, latestDate),
    getPreviousMetricDate(hotelId, latestDate),
    getLatestInsight(hotelId),
    generateExecutiveSummary(hotelId, locale),
    listReportUploads(hotelId, 5),
  ]);
  const previousMetrics = previousDate ? await getMetricsForDate(hotelId, previousDate) : [];

  const metricByKey = new Map(metrics.map((m) => [m.metricKey, m]));
  const previousByKey = new Map(previousMetrics.map((m) => [m.metricKey, m.value]));
  const morningBrief = buildMorningBrief({
    hotelName: membership.hotel.name,
    locale,
    latestDate,
    metrics,
    previousMetrics,
    insight,
  });

  const qualityScores = metrics
    .map((m) => m.sourceReportDocument?.completenessScore)
    .filter((s): s is number => s !== null && s !== undefined);
  const avgQuality = qualityScores.length > 0 ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : null;

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-ink">
            {dict.missionControl.greeting}, {user?.displayName}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {membership.hotel.name} · {latestDate.toLocaleDateString(locale)}
          </p>
        </div>
        {avgQuality !== null ? (
          <StatusBadge tone={dataQualityTone(avgQuality)}>
            {dict.missionControl.dataQuality}: {Math.round(avgQuality * 100)}%
          </StatusBadge>
        ) : null}
      </div>

      <Card>
        <CardTitle>{dict.missionControl.morningBrief}</CardTitle>
        <ul className="mt-2 space-y-1 text-sm">
          {morningBrief.lines.map((line, i) => (
            <li key={i} className={i === 0 ? 'font-medium text-ink' : 'text-ink-muted'}>
              {line}
            </li>
          ))}
        </ul>
      </Card>

      {insight?.healthScore !== null && insight?.healthScore !== undefined ? (
        <Card>
          <div className="flex items-baseline justify-between">
            <CardTitle>{dict.missionControl.healthScore}</CardTitle>
            <span className="metric-value text-3xl font-semibold text-ink">{insight.healthScore}</span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {(insight.healthScoreFactors as unknown as HealthFactor[]).map((f) => (
              <div key={f.factorKey} className="flex items-center justify-between">
                <dt className="text-ink-muted">
                  {f.labelEn}
                  {f.status === 'insufficient_data' ? (
                    <span className="ms-2 text-xs text-status-warning">({dict.missionControl.insufficientData})</span>
                  ) : null}
                </dt>
                <dd className="metric-value text-ink">
                  {Math.round(f.contribution)} / {f.weight}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      <section>
        <h2 className="text-sm font-medium text-ink-muted">{dict.missionControl.keyMetrics}</h2>
        <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {KEY_METRIC_KEYS.map((key) => {
            const m = metricByKey.get(key);
            if (!m || m.value === null) return null;
            const doc = m.sourceReportDocument;
            const previousValue = previousByKey.get(key);
            const delta = previousValue !== undefined && previousValue !== null ? m.value - previousValue : null;
            const label = locale === 'ar' ? m.metricDefinition.labelAr : m.metricDefinition.labelEn;
            return (
              <Card key={key} className="p-4">
                <div className="text-sm text-ink-muted">{label}</div>
                <div className="metric-value mt-1 text-2xl font-semibold text-ink">
                  {formatMetricValue(m.value, m.metricDefinition.unit)}
                </div>
                {delta !== null ? (
                  <div className="metric-value mt-1 text-xs text-ink-muted">
                    {delta >= 0 ? '+' : ''}
                    {formatMetricValue(delta, m.metricDefinition.unit)} {dict.missionControl.vsPrevious}
                  </div>
                ) : null}
                <div className="mt-2 space-y-0.5 text-xs text-ink-muted">
                  {doc ? (
                    <>
                      <div>
                        {dict.missionControl.confidence}: {Math.round((doc.extractionConfidence ?? 0) * 100)}%
                        {' · '}
                        {dict.missionControl.completeness}: {Math.round((doc.completenessScore ?? 0) * 100)}%
                      </div>
                      <div className="truncate">
                        {dict.missionControl.source}: {doc.reportUpload.originalFilename}
                      </div>
                    </>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{dict.missionControl.recentUploads}</CardTitle>
          <Link href={`/${locale}/reports/archive`} className="text-xs text-accent hover:underline">
            {dict.missionControl.viewArchive}
          </Link>
        </CardHeader>
        {recentUploads.length === 0 ? (
          <p className="text-sm text-ink-muted">{dict.reportsUpload.noUploads}</p>
        ) : (
          <ul className="divide-y divide-ink/5 text-sm">
            {recentUploads.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2.5">
                <Link href={`/${locale}/reports/${u.id}`} className="truncate text-ink hover:underline">
                  {u.originalFilename}
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-ink-muted">{new Date(u.createdAt).toLocaleDateString(locale)}</span>
                  <StatusBadge tone={reportStatusTone(u.status)}>{u.status}</StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">{dict.missionControl.alerts}</h2>
        {!insight || insight.alerts.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">{dict.missionControl.noAlerts}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {insight.alerts.map((a) => (
              <li
                key={a.id}
                className={
                  'rounded-md border p-3 text-sm ' +
                  (a.severity === 'critical'
                    ? 'border-status-critical/40 bg-status-critical/10'
                    : a.severity === 'warning'
                    ? 'border-status-warning/40 bg-status-warning/10'
                    : 'border-status-info/40 bg-status-info/10')
                }
              >
                {locale === 'ar' ? a.messageAr : a.messageEn}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">{dict.missionControl.risksOpportunities}</h2>
        {!insight || insight.recommendations.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">{dict.missionControl.noRecommendations}</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {insight.recommendations.map((r) => (
              <li key={r.id} className="rounded-lg border border-ink/10 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase text-ink-muted">{r.category}</span>
                  <span className="text-xs text-ink-muted">
                    {dict.missionControl.priority}: {r.priority} · {dict.missionControl.confidence}:{' '}
                    {Math.round(r.confidence * 100)}%
                  </span>
                </div>
                <p className="mt-2">
                  <span className="text-ink-muted">{dict.missionControl.why}: </span>
                  {locale === 'ar' ? r.textAr : r.textEn}
                </p>
                <p className="mt-1">
                  <span className="text-ink-muted">{dict.missionControl.suggestedAction}: </span>
                  {locale === 'ar' ? r.suggestedActionAr : r.suggestedActionEn}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink-muted">{dict.missionControl.aiSummary}</h2>
        {aiSummary.ok ? (
          <div className="mt-2 rounded-lg border border-ink/10 p-4 text-sm">
            <p>{aiSummary.summary}</p>
            <p className="mt-3 text-xs text-ink-muted">
              {dict.missionControl.citedFrom}: {aiSummary.citedMetrics.map((c) => c.labelEn).join(', ')}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">{dict.missionControl.aiSummaryUnavailable[aiSummary.reason]}</p>
        )}
      </section>
    </div>
  );
}
