import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { getActiveMembership } from '@/server/modules/hotels/access';
import {
  getLatestMetricDate,
  getRecentMetricDates,
  getMetricsForDates,
  getAllMetricDefinitions,
  getMetricCorrectionHistory,
  parseMetricCorrectionHistory,
} from '@/server/modules/metrics/queries';
import { getLatestInsight } from '@/server/modules/insights/queries';
import { buildMorningBrief } from '@/server/modules/insights/morning-brief';
import { resolveSupportingMetrics } from '@/server/modules/insights/evidence';
import { getOrRefreshExecutiveSummary } from '@/server/modules/ai-orchestration/commands';
import { listReportUploads } from '@/server/modules/reports/queries';
import { correctMetricAction, regenerateExecutiveSummaryAction } from './actions';
import { MetricCorrectionControl } from './MetricCorrectionControl';
import { formatMetricValue } from '@/lib/format-metric';
import { reportTypeLabel } from '@/lib/report-type-label';
import type { HealthFactor } from '@/server/modules/insights/scoring';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { EvidenceDrawer } from '@/components/ui/EvidenceDrawer';
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
  const latestDate = await getLatestMetricDate(hotelId);

  if (!latestDate) {
    // Only needed to pick the empty-state copy on this already-empty path —
    // fetching it unconditionally on every request (including the common
    // case where latestDate exists) was a wasted round trip (Perf sprint, M14).
    const hasAnyUpload = (await prisma.reportUpload.count({ where: { hotelId } })) > 0;
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

  // recentDates(2) + a single getMetricsForDates(both) replaces what was
  // 3 separate round trips (getMetricsForDate(latest), getPreviousMetricDate,
  // getMetricsForDate(previous)) with 2 — see getRecentMetricDates'
  // docblock (Perf sprint round 2).
  const [recentDates, insight, recentUploads, metricDefinitions] = await Promise.all([
    getRecentMetricDates(hotelId, 2),
    getLatestInsight(hotelId),
    listReportUploads(hotelId, 5),
    getAllMetricDefinitions(),
  ]);
  const previousDate = recentDates[1] ?? null;
  const allMetrics = await getMetricsForDates(hotelId, recentDates);
  const metrics = allMetrics.filter((m) => m.metricDate.getTime() === latestDate.getTime());
  const previousMetrics = previousDate ? allMetrics.filter((m) => m.metricDate.getTime() === previousDate.getTime()) : [];
  const aiSummary = await getOrRefreshExecutiveSummary(hotelId, locale, membership.hotel.name, { latestDate, metrics });

  const metricByKey = new Map(metrics.map((m) => [m.metricKey, m]));
  const previousByKey = new Map(previousMetrics.map((m) => [m.metricKey, m.value]));

  // Consistency checks (Analytics fix, Phase 4) — only KpiCards for a
  // flagged key get a correction control; everyone else's card renders
  // exactly as before. Only ever HOTEL_ADMIN/GENERAL_MANAGER sees the edit
  // control itself (checked again server-side in the action).
  const canCorrectMetrics = membership.role === 'HOTEL_ADMIN' || membership.role === 'GENERAL_MANAGER';
  const consistencyAlertsByKey = new Map(
    (insight?.alerts ?? [])
      .filter((a) => a.category === 'consistency' && a.relatedMetricKey)
      .map((a) => [a.relatedMetricKey as string, a])
  );
  const flaggedKeys = Array.from(consistencyAlertsByKey.keys());
  const correctionHistoryByKey = new Map(
    flaggedKeys.length > 0
      ? await Promise.all(
          flaggedKeys.map(async (key) => {
            const rows = parseMetricCorrectionHistory(await getMetricCorrectionHistory(hotelId, latestDate, key));
            return [key, rows.map((r) => ({ ...r, createdAt: r.createdAt.toLocaleString(locale) }))] as const;
          })
        )
      : []
  );

  const qualityScores = metrics
    .map((m) => m.sourceReportDocument?.completenessScore)
    .filter((s): s is number => s !== null && s !== undefined);
  const avgQuality = qualityScores.length > 0 ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : null;

  const morningBrief = buildMorningBrief({
    hotelName: membership.hotel.name,
    locale,
    latestDate,
    metrics,
    previousMetrics,
    insight,
    avgDataQuality: avgQuality,
  });

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
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

      <Card className="space-y-4">
        <CardHeader>
          <CardTitle>{dict.missionControl.morningBrief}</CardTitle>
          <Link href={`/${locale}/reports/export`} className="text-xs text-accent hover:underline">
            {dict.executiveExport.exportLink}
          </Link>
        </CardHeader>

        <div>
          <h3 className="text-xs font-medium uppercase text-ink-muted">{dict.missionControl.brief.todaySummary}</h3>
          <p className="mt-1 text-sm font-medium text-ink">{morningBrief.todaySummary}</p>
        </div>

        {morningBrief.keyNumbers.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium uppercase text-ink-muted">{dict.missionControl.brief.keyNumbers}</h3>
            <ul className="mt-1 space-y-0.5 text-sm text-ink">
              {morningBrief.keyNumbers.map((k) => (
                <li key={k.label}>
                  {k.label}: <span className="metric-value">{k.value}</span>
                  {k.trend ? <span className="text-ink-muted"> ({k.trend})</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <h3 className="text-xs font-medium uppercase text-ink-muted">{dict.missionControl.brief.whatChanged}</h3>
          <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
            {morningBrief.whatChanged.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium uppercase text-status-critical">{dict.missionControl.brief.risks}</h3>
            <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
              {morningBrief.risks.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-medium uppercase text-status-positive">{dict.missionControl.brief.opportunities}</h3>
            <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
              {morningBrief.opportunities.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        {morningBrief.todayActions.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium uppercase text-ink-muted">{dict.missionControl.brief.todayActions}</h3>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink-muted">
              {morningBrief.todayActions.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {morningBrief.priority ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium uppercase text-ink-muted">{dict.missionControl.brief.priority}</h3>
              <p className="mt-1 text-sm text-ink">{morningBrief.priority}</p>
            </div>
            {morningBrief.suggestedOwner ? (
              <div>
                <h3 className="text-xs font-medium uppercase text-ink-muted">{dict.missionControl.brief.suggestedOwner}</h3>
                <p className="metric-value mt-1 text-sm text-ink">{dict.hotelRoles[morningBrief.suggestedOwner]}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <h3 className="text-xs font-medium uppercase text-ink-muted">{dict.missionControl.brief.dataStatus}</h3>
          <p className="mt-1 text-sm text-ink-muted">{morningBrief.dataQuality.statusText}</p>
          {morningBrief.dataQuality.flaggedDocuments.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5 text-xs text-status-warning">
              {morningBrief.dataQuality.flaggedDocuments.map((d, i) => (
                <li key={i}>
                  {reportTypeLabel(d.reportType, dict.reportsCommon.reportTypes)}: {Math.round(d.completenessScore * 100)}%
                </li>
              ))}
            </ul>
          ) : null}
        </div>
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
                  {locale === 'ar' ? f.labelAr : f.labelEn}
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
            const consistencyAlert = consistencyAlertsByKey.get(key);
            return (
              <KpiCard
                key={key}
                label={label}
                value={formatMetricValue(m.value, m.metricDefinition.unit)}
                tone={consistencyAlert ? 'warning' : delta !== null ? (delta >= 0 ? 'positive' : 'critical') : 'neutral'}
                trend={
                  <>
                    {delta !== null ? (
                      <div className="metric-value text-ink">
                        {delta >= 0 ? '+' : ''}
                        {formatMetricValue(delta, m.metricDefinition.unit)} {dict.missionControl.vsPrevious}
                      </div>
                    ) : null}
                    {doc ? (
                      <>
                        <div className="mt-1">
                          {dict.missionControl.confidence}: {Math.round((doc.extractionConfidence ?? 0) * 100)}%
                          {' · '}
                          {dict.missionControl.completeness}: {Math.round((doc.completenessScore ?? 0) * 100)}%
                        </div>
                        <div className="truncate" title={doc.reportUpload.originalFilename}>
                          {dict.missionControl.source}: {reportTypeLabel(doc.reportType, dict.reportsCommon.reportTypes)}
                        </div>
                      </>
                    ) : null}
                    {consistencyAlert ? (
                      <MetricCorrectionControl
                        action={correctMetricAction.bind(null, locale, hotelId, latestDate.toISOString(), key)}
                        canCorrect={canCorrectMetrics}
                        alertMessage={locale === 'ar' ? consistencyAlert.messageAr : consistencyAlert.messageEn}
                        history={correctionHistoryByKey.get(key) ?? []}
                        dict={dict.missionControl.correction}
                      />
                    ) : null}
                  </>
                }
              />
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
          <EmptyState title={dict.reportsUpload.noUploads} />
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
              <li key={a.id}>
                <Card
                  className={
                    'p-3 text-sm ' +
                    (a.severity === 'critical'
                      ? 'border-status-critical/30 bg-status-critical/[0.06]'
                      : a.severity === 'warning'
                      ? 'border-status-warning/30 bg-status-warning/[0.06]'
                      : 'border-status-info/30 bg-status-info/[0.06]')
                  }
                >
                  {locale === 'ar' ? a.messageAr : a.messageEn}
                </Card>
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
            {insight.recommendations.map((r) => {
              const evidence = resolveSupportingMetrics(r.supportingMetrics, metricDefinitions, locale, dict.missionControl.evidence.unresolvedMetric);
              return (
                <li key={r.id}>
                  <Card className="p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{dict.missionControl.categories[r.category]}</span>
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
                    <EvidenceDrawer items={evidence} toggleLabel={dict.missionControl.evidence.toggle} asOfLabel={dict.missionControl.evidence.asOf} />
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-ink-muted">{dict.missionControl.aiSummary}</h2>
          {canCorrectMetrics ? (
            <form action={regenerateExecutiveSummaryAction.bind(null, locale, hotelId)}>
              <Button type="submit" size="sm" variant="ghost">
                {dict.missionControl.regenerateSummary}
              </Button>
            </form>
          ) : null}
        </div>
        {aiSummary.ok ? (
          <Card className="mt-2 text-sm">
            <p>{aiSummary.summary}</p>
            <p className="mt-3 text-xs text-ink-muted">
              {dict.missionControl.citedFrom}: {aiSummary.citedMetrics.map((c) => c.labelEn).join(', ')}
            </p>
          </Card>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">{dict.missionControl.aiSummaryUnavailable[aiSummary.reason]}</p>
        )}
      </section>
    </div>
  );
}
