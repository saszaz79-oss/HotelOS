import type { HotelDepartment, RiskSeverity, OpportunityValue, DecisionWindow } from '@prisma/client';
import { redirect } from 'next/navigation';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import {
  getLatestMetricDate,
  getRecentMetricDates,
  getMetricsForDates,
  getMetricsForDateRange,
  getAllMetricDefinitions,
} from '@/server/modules/metrics/queries';
import { getLatestInsight } from '@/server/modules/insights/queries';
import { buildMorningBrief } from '@/server/modules/insights/morning-brief';
import { computeExecutiveScoreBreakdown } from '@/server/modules/insights/scoring';
import { resolveSupportingMetrics } from '@/server/modules/insights/evidence';
import { getOrRefreshExecutiveSummary, getOrRefreshExecutiveIntelligence } from '@/server/modules/ai-orchestration/commands';
import { recordExport } from '@/server/modules/exports/commands';
import { formatMetricValue } from '@/lib/format-metric';
import { reportTypeLabel } from '@/lib/report-type-label';
import { healthScoreTone, riskSeverityTone, opportunityValueTone, decisionWindowTone, departmentTone } from '@/lib/status-tone';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TableShell, tableHeadRowClass, tableHeadCellClass, tableRowClass, tableCellClass } from '@/components/ui/TableShell';
import { TrendChart } from '@/components/ui/TrendChart';
import { EvidenceDrawer } from '@/components/ui/EvidenceDrawer';
import { PrintButton } from './PrintButton';
import { regenerateExecutiveSummaryAction } from './actions';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Same list Mission Control uses for its Key Metrics grid — keeps the two
// screens showing the same "what matters" set (Analytics fix, Phase 5).
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

const TREND_DAYS = 14;

// Period-aggregate metrics from EDI Phase 2.5's Reservation Statistics /
// History & Forecast / Day-MTD-YTD Statistics adapters — genuinely new
// information beyond Manager Flash's single-day KPIs above, so shown in
// their own sections rather than folded into the day-over-day KEY_METRIC_KEYS
// table (a different reporting period isn't a comparable "previous value").
const MTD_METRIC_KEYS = ['mtd_rooms_sold', 'mtd_room_revenue', 'mtd_adr', 'mtd_occupancy_pct', 'mtd_total_guests'];
const FORECAST_METRIC_KEYS = ['forecast_rooms_occupied', 'forecast_room_revenue', 'forecast_adr', 'forecast_occupancy_pct'];
const YTD_METRIC_KEYS = ['ytd_rooms_sold', 'ytd_adr', 'ytd_total_guests'];

/**
 * Deterministic, reproducible reference — not a stored incrementing
 * sequence (none exists), built entirely from real, already-known data
 * (property code or a hotel-id fallback, plus the business date) so it's
 * never a fabricated number standing in for a real document ID.
 */
function buildReportReference(propertyCode: string | null, hotelId: string, date: Date): string {
  const code = propertyCode?.trim() || hotelId.slice(0, 6).toUpperCase();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `EIR-${code}-${datePart}`;
}

/**
 * Renders whichever of department/severity/opportunityValue/decisionWindow
 * are actually populated on a recommendation (Executive Decision
 * Intelligence redesign) — a pre-Phase-1 row has all four null and simply
 * renders no badges, honestly reflecting that it was never classified,
 * rather than a placeholder badge.
 */
function RecommendationBadges({
  r,
  dict,
}: {
  r: {
    department: HotelDepartment | null;
    severity: RiskSeverity | null;
    opportunityValue: OpportunityValue | null;
    decisionWindow: DecisionWindow | null;
  };
  dict: ReturnType<typeof getDictionary>;
}) {
  if (!r.department && !r.severity && !r.opportunityValue && !r.decisionWindow) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {r.department ? <StatusBadge tone={departmentTone(r.department)}>{dict.hotelDepartments[r.department]}</StatusBadge> : null}
      {r.severity ? <StatusBadge tone={riskSeverityTone(r.severity)}>{dict.riskSeverities[r.severity]}</StatusBadge> : null}
      {r.opportunityValue ? (
        <StatusBadge tone={opportunityValueTone(r.opportunityValue)}>{dict.opportunityValues[r.opportunityValue]}</StatusBadge>
      ) : null}
      {r.decisionWindow ? <StatusBadge tone={decisionWindowTone(r.decisionWindow)}>{dict.decisionWindows[r.decisionWindow]}</StatusBadge> : null}
    </div>
  );
}

export default async function ExecutiveExportPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const membership = !user.isSuperAdmin ? await getActiveMembership(user.id) : null;
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
    return (
      <div className="max-w-3xl">
        <EmptyState title={dict.missionControl.noReports} />
      </div>
    );
  }

  const rangeFrom = new Date(latestDate);
  rangeFrom.setDate(rangeFrom.getDate() - (TREND_DAYS - 1));

  const [recentDates, insight, metricDefinitions, rangeMetrics] = await Promise.all([
    getRecentMetricDates(hotelId, 2),
    getLatestInsight(hotelId),
    getAllMetricDefinitions(),
    getMetricsForDateRange(hotelId, rangeFrom, latestDate),
  ]);
  const previousDate = recentDates[1] ?? null;
  const allMetrics = await getMetricsForDates(hotelId, recentDates);
  const metrics = allMetrics.filter((m) => m.metricDate.getTime() === latestDate.getTime());
  const previousMetrics = previousDate ? allMetrics.filter((m) => m.metricDate.getTime() === previousDate.getTime()) : [];
  // Both AI calls read through their own independent cache (Perf Phase 1B /
  // EDI Phase 2) — run in parallel rather than sequentially, same as any
  // other independent Promise.all in this pipeline.
  const [aiSummary, aiIntelligence] = await Promise.all([
    getOrRefreshExecutiveSummary(hotelId, locale, membership.hotel.name, { latestDate, metrics, previousMetrics }),
    getOrRefreshExecutiveIntelligence(hotelId, locale, membership.hotel.name, { latestDate, metrics, previousMetrics }),
  ]);
  const metricByKey = new Map(metrics.map((m) => [m.metricKey, m]));
  const previousByKey = new Map(previousMetrics.map((m) => [m.metricKey, m.value]));

  const qualityScores = metrics
    .map((m) => m.sourceReportDocument?.completenessScore)
    .filter((s): s is number => s !== null && s !== undefined);
  const avgQuality = qualityScores.length > 0 ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : null;

  // Executive Score breakdown and classified Top Priorities/Risks/
  // Opportunities (Executive Decision Intelligence redesign, Phase 3) only
  // exist once an Insight row has actually been computed for this exact
  // date, with a real health score on it — never fabricated when either is
  // missing (e.g. immediately after upload, before the pipeline's
  // insight-recompute step finishes). `healthScore` is nullable in schema
  // even though recomputeInsight always sets it alongside the row in
  // practice — this guard is what makes that a checked fact, not an
  // assumption.
  const healthScore = insight?.healthScore ?? null;
  const scoreBreakdown =
    healthScore !== null
      ? computeExecutiveScoreBreakdown(
          healthScore,
          metrics.map((m) => ({ key: m.metricKey, value: m.value })),
          previousMetrics.length > 0 ? previousMetrics.map((m) => ({ key: m.metricKey, value: m.value })) : null,
          avgQuality
        )
      : null;
  const allRecommendations = insight?.recommendations ?? [];
  // Already ordered by priority ascending (getLatestInsight's own query
  // order) — taking the first N is taking the N most urgent, not an
  // arbitrary slice.
  const topPriorities = allRecommendations.slice(0, 5);
  const topRisks = allRecommendations.filter((r) => r.category === 'risk').slice(0, 3);
  const topOpportunities = allRecommendations.filter((r) => r.category === 'opportunity').slice(0, 3);

  const overallStatusTone = healthScore !== null ? healthScoreTone(healthScore) : null;
  const noteFor = (cat: { noteEn: string; noteAr: string }) => (locale === 'ar' ? cat.noteAr : cat.noteEn);
  const scoreTiles: { label: string; score: number | null; note: string | null }[] = scoreBreakdown
    ? [
        { label: dict.executiveExport.morningBrief.overallScore, score: scoreBreakdown.overallBusinessHealth, note: null },
        { label: dict.executiveExport.morningBrief.financialHealth, score: scoreBreakdown.financialHealth.score, note: noteFor(scoreBreakdown.financialHealth) },
        { label: dict.executiveExport.morningBrief.operationalHealth, score: scoreBreakdown.operationalHealth.score, note: noteFor(scoreBreakdown.operationalHealth) },
        { label: dict.executiveExport.morningBrief.revenueHealth, score: scoreBreakdown.revenueHealth.score, note: noteFor(scoreBreakdown.revenueHealth) },
        { label: dict.executiveExport.morningBrief.guestExperienceHealth, score: scoreBreakdown.guestExperienceHealth.score, note: noteFor(scoreBreakdown.guestExperienceHealth) },
        { label: dict.executiveExport.morningBrief.dataQuality, score: scoreBreakdown.dataQuality.score, note: noteFor(scoreBreakdown.dataQuality) },
      ]
    : [];

  const morningBrief = buildMorningBrief({
    hotelName: membership.hotel.name,
    locale,
    latestDate,
    metrics,
    previousMetrics,
    insight,
    avgDataQuality: avgQuality,
  });

  // Deduped by filename (the only stable per-document identifier this select
  // carries) — used to build both a humanized "N reports of type X" summary
  // and the raw filenames, which stay available but collapsed behind a
  // toggle rather than shown inline in executive-facing prose (Analytics
  // fix, Phase 1: a QA/internal filename like "phase9-analytics-test.pdf"
  // has no place in a document a hotel owner might forward externally).
  const sourceDocuments = Array.from(
    new Map(
      metrics
        .filter((m) => m.sourceReportDocument)
        .map((m) => [m.sourceReportDocument!.reportUpload.originalFilename, m.sourceReportDocument!])
    ).values()
  );
  const sourceFilenames = sourceDocuments.map((d) => d.reportUpload.originalFilename);
  const sourceTypeCounts = new Map<string, number>();
  for (const d of sourceDocuments) {
    const label = reportTypeLabel(d.reportType, dict.reportsCommon.reportTypes);
    sourceTypeCounts.set(label, (sourceTypeCounts.get(label) ?? 0) + 1);
  }
  const sourceTypesSummary = Array.from(sourceTypeCounts.entries())
    .map(([label, count]) => (count > 1 ? `${label} (${count})` : label))
    .join(locale === 'ar' ? '، ' : ', ');

  const rows = metrics
    .filter((m) => m.value !== null)
    .map((m) => {
      const current = m.value as number;
      const previous = previousByKey.get(m.metricKey);
      const hasPrevious = previous !== undefined && previous !== null;
      const delta = hasPrevious ? current - (previous as number) : null;
      const pctChange = hasPrevious && previous !== 0 ? (delta! / (previous as number)) * 100 : null;
      return {
        key: m.metricKey,
        label: locale === 'ar' ? m.metricDefinition.labelAr : m.metricDefinition.labelEn,
        unit: m.metricDefinition.unit,
        current,
        previous: hasPrevious ? (previous as number) : null,
        delta,
        pctChange,
      };
    });

  const trendPoints = rangeMetrics
    .filter((m) => m.metricKey === 'occupancy_pct' && m.value !== null)
    .map((m) => ({ date: m.metricDate.toISOString().slice(0, 10), value: m.value as number }));

  const consistencyAlerts = (insight?.alerts ?? []).filter((a) => a.category === 'consistency');

  await recordExport(hotelId, user.id, locale, latestDate);

  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-surface-raised p-8 text-ink print:max-w-none print:space-y-4 print:bg-white print:p-0">
      <div className="print-hide flex justify-end">
        <PrintButton label={dict.executiveExport.printAction} />
      </div>

      <header className="flex items-start justify-between gap-4 border-b border-ink/10 pb-4">
        <div>
          {membership.hotel.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={membership.hotel.logoUrl} alt="" className="mb-2 h-10 w-auto object-contain" />
          ) : null}
          <h1 className="text-xl font-semibold">
            {(locale === 'ar' ? membership.hotel.officialNameAr : membership.hotel.officialNameEn) || membership.hotel.name}
          </h1>
          <p className="text-sm text-ink-muted">{dict.executiveExport.title}</p>
          {membership.hotel.address ? <p className="mt-1 text-xs text-ink-muted">{membership.hotel.address}</p> : null}
          {membership.hotel.contactPhone || membership.hotel.contactEmail ? (
            <p className="text-xs text-ink-muted">
              {[membership.hotel.contactPhone, membership.hotel.contactEmail].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
        <div className="text-end text-sm text-ink-muted">
          <p>
            {dict.executiveExport.propertyCode}:{' '}
            {membership.hotel.propertyCode || <span className="italic">{dict.executiveExport.notConfigured}</span>}
          </p>
          <p>
            {dict.executiveExport.generalManager}:{' '}
            {membership.hotel.generalManagerName ? (
              <>
                {membership.hotel.generalManagerName}
                {membership.hotel.generalManagerTitle ? `, ${membership.hotel.generalManagerTitle}` : ''}
              </>
            ) : (
              <span className="italic">{dict.executiveExport.notConfigured}</span>
            )}
          </p>
          <p>
            {dict.executiveExport.reportReference}: {buildReportReference(membership.hotel.propertyCode, hotelId, latestDate)}
          </p>
          <p>
            {dict.executiveExport.businessDate}: {latestDate.toLocaleDateString(locale)}
          </p>
          <p>
            {dict.executiveExport.generatedAt}: {new Date().toLocaleString(locale)}
          </p>
        </div>
      </header>

      {/* Executive Morning Brief (Executive Decision Intelligence redesign,
          Phase 3) — the first thing a GM reads: real status, real 6-way
          score breakdown, the real top-5/top-3 classified priorities/risks/
          opportunities, and the AI narrative layer's executive message.
          Degrades to an honest "not yet analyzed" line when no Insight
          exists for this date yet, and to an honest unavailable reason for
          the narrative when no AI provider is configured — the real
          deterministic content above it is never blocked by either gap. */}
      <section className="space-y-4 border-b border-ink/10 pb-6 print:pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">{dict.executiveExport.morningBrief.title}</h2>
            <p className="text-xs text-ink-muted">{dict.executiveExport.morningBrief.subtitle}</p>
          </div>
          {overallStatusTone ? (
            <StatusBadge tone={overallStatusTone}>
              {overallStatusTone === 'positive'
                ? dict.executiveExport.morningBrief.statusHealthy
                : overallStatusTone === 'warning'
                ? dict.executiveExport.morningBrief.statusAttention
                : dict.executiveExport.morningBrief.statusCritical}
            </StatusBadge>
          ) : null}
        </div>

        {!scoreBreakdown ? (
          <p className="text-sm text-ink-muted">{dict.executiveExport.morningBrief.notYetAnalyzed}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
              {scoreTiles.map((t, i) => (
                <KpiCard
                  key={i}
                  label={t.label}
                  value={t.score !== null ? `${t.score} ${dict.executiveExport.morningBrief.outOf100}` : dict.executiveExport.morningBrief.insufficientData}
                  tone={t.score === null ? 'neutral' : healthScoreTone(t.score)}
                  trend={t.note ? <span>{t.note}</span> : null}
                />
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase text-ink-muted">{dict.executiveExport.morningBrief.topPriorities}</h3>
                {topPriorities.length === 0 ? (
                  <p className="text-sm text-ink-muted">{dict.executiveExport.morningBrief.noPriorities}</p>
                ) : (
                  <ol className="space-y-3">
                    {topPriorities.map((r, i) => {
                      const impact = aiIntelligence.ok ? aiIntelligence.businessImpactEstimates[r.id] : undefined;
                      return (
                        <li key={r.id} className="rounded-lg border border-ink/10 p-3 text-sm">
                          <p className="text-ink">
                            <span className="metric-value me-1.5 text-ink-muted">{i + 1}.</span>
                            {locale === 'ar' ? r.textAr : r.textEn}
                          </p>
                          <p className="mt-1 text-ink-muted">{locale === 'ar' ? r.suggestedActionAr : r.suggestedActionEn}</p>
                          <RecommendationBadges r={r} dict={dict} />
                          {impact ? (
                            <p className="mt-1.5 text-xs italic text-ink-muted">
                              {dict.executiveExport.morningBrief.estimatedImpact}: {impact}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase text-ink-muted">{dict.executiveExport.morningBrief.topRisks}</h3>
                {topRisks.length === 0 ? (
                  <p className="text-sm text-ink-muted">{dict.executiveExport.morningBrief.noRisks}</p>
                ) : (
                  <ul className="space-y-3">
                    {topRisks.map((r) => {
                      const elaboration = aiIntelligence.ok ? aiIntelligence.riskElaboration[r.id] : undefined;
                      return (
                        <li key={r.id} className="rounded-lg border border-ink/10 p-3 text-sm">
                          <p className="text-ink">{locale === 'ar' ? r.textAr : r.textEn}</p>
                          <RecommendationBadges r={r} dict={dict} />
                          {elaboration ? <p className="mt-1.5 text-xs text-ink-muted">{elaboration}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase text-ink-muted">{dict.executiveExport.morningBrief.topOpportunities}</h3>
                {topOpportunities.length === 0 ? (
                  <p className="text-sm text-ink-muted">{dict.executiveExport.morningBrief.noOpportunities}</p>
                ) : (
                  <ul className="space-y-3">
                    {topOpportunities.map((r) => {
                      const elaboration = aiIntelligence.ok ? aiIntelligence.opportunityElaboration[r.id] : undefined;
                      return (
                        <li key={r.id} className="rounded-lg border border-ink/10 p-3 text-sm">
                          <p className="text-ink">{locale === 'ar' ? r.textAr : r.textEn}</p>
                          <RecommendationBadges r={r} dict={dict} />
                          {elaboration ? <p className="mt-1.5 text-xs text-ink-muted">{elaboration}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <Card className="print:border-0 print:p-0 print:shadow-none">
              <CardHeader>
                <CardTitle>{dict.executiveExport.morningBrief.executiveMessage}</CardTitle>
              </CardHeader>
              {aiIntelligence.ok ? (
                <div className="space-y-2 text-sm">
                  {aiIntelligence.executiveMessage
                    .split(/\n{2,}/)
                    .filter((p) => p.trim().length > 0)
                    .map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-ink-muted">{dict.executiveExport.morningBrief.executiveMessageUnavailable[aiIntelligence.reason]}</p>
              )}
            </Card>
          </>
        )}
      </section>

      <Card className="print:border-0 print:p-0 print:shadow-none">
        <CardHeader>
          <CardTitle>{dict.executiveExport.executiveSummary}</CardTitle>
          {membership.role === 'HOTEL_ADMIN' || membership.role === 'GENERAL_MANAGER' ? (
            <form action={regenerateExecutiveSummaryAction.bind(null, locale, hotelId)} className="print-hide">
              <Button type="submit" size="sm" variant="ghost">
                {dict.missionControl.regenerateSummary}
              </Button>
            </form>
          ) : null}
        </CardHeader>
        <p className="text-sm">{morningBrief.todaySummary}</p>
        {aiSummary.ok ? (
          <p className="mt-2 text-sm text-ink-muted">{aiSummary.summary}</p>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">{dict.missionControl.aiSummaryUnavailable[aiSummary.reason]}</p>
        )}
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-ink-muted">{dict.executiveExport.kpis}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
          {KEY_METRIC_KEYS.map((key) => {
            const m = metricByKey.get(key);
            if (!m || m.value === null) return null;
            const previousValue = previousByKey.get(key);
            const delta = previousValue !== undefined && previousValue !== null ? m.value - previousValue : null;
            const label = locale === 'ar' ? m.metricDefinition.labelAr : m.metricDefinition.labelEn;
            return (
              <KpiCard
                key={key}
                label={label}
                value={formatMetricValue(m.value, m.metricDefinition.unit)}
                tone={delta !== null ? (delta >= 0 ? 'positive' : 'critical') : 'neutral'}
                trend={
                  delta !== null ? (
                    <span className="metric-value">
                      {delta >= 0 ? '+' : ''}
                      {formatMetricValue(delta, m.metricDefinition.unit)}
                    </span>
                  ) : null
                }
              />
            );
          })}
        </div>
      </section>

      {[
        { titleKey: 'monthToDate' as const, keys: MTD_METRIC_KEYS, note: null },
        { titleKey: 'forecast' as const, keys: FORECAST_METRIC_KEYS, note: dict.executiveExport.forecastNote },
        { titleKey: 'yearToDate' as const, keys: YTD_METRIC_KEYS, note: null },
      ].map(({ titleKey, keys, note }) => {
        const available = keys.filter((k) => {
          const m = metricByKey.get(k);
          return m && m.value !== null;
        });
        if (available.length === 0) return null;
        return (
          <section key={titleKey}>
            <h2 className="mb-1 text-sm font-semibold uppercase text-ink-muted">{dict.executiveExport[titleKey]}</h2>
            <p className="mb-2 text-xs text-ink-muted">{note ?? dict.executiveExport.periodMetricsNote}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
              {available.map((key) => {
                const m = metricByKey.get(key)!;
                const label = locale === 'ar' ? m.metricDefinition.labelAr : m.metricDefinition.labelEn;
                return <KpiCard key={key} label={label} value={formatMetricValue(m.value as number, m.metricDefinition.unit)} tone="neutral" />;
              })}
            </div>
          </section>
        );
      })}

      {trendPoints.length > 1 ? (
        <Card className="print-hide">
          <CardHeader>
            <CardTitle>{dict.executiveExport.trend}</CardTitle>
          </CardHeader>
          <TrendChart
            points={trendPoints}
            formatValue={(v) => formatMetricValue(v, 'percentage')}
            formatDate={(iso) => new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
            emptyLabel={dict.comparisons.notAvailable}
            height={160}
          />
        </Card>
      ) : null}

      <TableShell>
        <table className="w-full text-sm">
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={tableHeadCellClass}>{dict.comparisons.metric}</th>
              <th className={tableHeadCellClass}>{dict.comparisons.current}</th>
              <th className={tableHeadCellClass}>{dict.comparisons.previous}</th>
              <th className={tableHeadCellClass}>{dict.comparisons.change}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={tableRowClass}>
                <td className={`${tableCellClass} text-ink`}>{r.label}</td>
                <td className={`metric-value ${tableCellClass}`}>{formatMetricValue(r.current, r.unit)}</td>
                <td className={`metric-value ${tableCellClass} text-ink-muted`}>
                  {r.previous !== null ? formatMetricValue(r.previous, r.unit) : dict.comparisons.notAvailable}
                </td>
                <td className={`metric-value ${tableCellClass}`}>
                  {r.delta === null ? (
                    <span className="text-ink-muted">{dict.comparisons.notAvailable}</span>
                  ) : (
                    <span className={r.delta >= 0 ? 'text-status-positive' : 'text-status-critical'}>
                      {r.delta >= 0 ? '+' : ''}
                      {formatMetricValue(r.delta, r.unit)}
                      {r.pctChange !== null ? ` (${r.pctChange >= 0 ? '+' : ''}${round1(r.pctChange)}%)` : ''}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="print:border-0 print:p-0 print:shadow-none">
          <CardHeader>
            <CardTitle>{dict.missionControl.brief.risks}</CardTitle>
          </CardHeader>
          <ul className="list-inside list-disc space-y-0.5 text-sm">
            {morningBrief.risks.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Card>
        <Card className="print:border-0 print:p-0 print:shadow-none">
          <CardHeader>
            <CardTitle>{dict.missionControl.brief.opportunities}</CardTitle>
          </CardHeader>
          <ul className="list-inside list-disc space-y-0.5 text-sm">
            {morningBrief.opportunities.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Card>
      </section>

      {insight && insight.recommendations.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase text-ink-muted">{dict.executiveExport.actionPlan}</h2>
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadRowClass}>
                  <th className={tableHeadCellClass}>{dict.executiveExport.action}</th>
                  <th className={`${tableHeadCellClass} print-hide`}>{dict.executiveExport.evidence}</th>
                  <th className={tableHeadCellClass}>{dict.executiveExport.owner}</th>
                  <th className={tableHeadCellClass}>{dict.executiveExport.timeframe}</th>
                  <th className={tableHeadCellClass}>{dict.executiveExport.expectedOutcome}</th>
                </tr>
              </thead>
              <tbody>
                {insight.recommendations.map((r) => {
                  const evidence = resolveSupportingMetrics(
                    r.supportingMetrics,
                    metricDefinitions,
                    locale,
                    dict.missionControl.evidence.unresolvedMetric
                  );
                  return (
                    <tr key={r.id} className={tableRowClass}>
                      <td className={`${tableCellClass} text-ink`}>{locale === 'ar' ? r.suggestedActionAr : r.suggestedActionEn}</td>
                      <td className={`${tableCellClass} print-hide`}>
                        <EvidenceDrawer items={evidence} toggleLabel={dict.missionControl.evidence.toggle} asOfLabel={dict.missionControl.evidence.asOf} />
                      </td>
                      {/* Owner/Timeframe/Expected Outcome (Analytics fix, Phase 6):
                          null on recommendations created before this migration —
                          shown honestly as unavailable rather than backfilled. */}
                      <td className={`${tableCellClass} text-ink`}>
                        {r.owner ? dict.hotelRoles[r.owner] : <span className="text-ink-muted">{dict.executiveExport.notYetAvailable}</span>}
                      </td>
                      <td className={`${tableCellClass} text-ink`}>
                        {r.timeframe ?? <span className="text-ink-muted">{dict.executiveExport.notYetAvailable}</span>}
                      </td>
                      <td className={`${tableCellClass} text-ink`}>
                        {(locale === 'ar' ? r.expectedOutcomeAr : r.expectedOutcomeEn) ?? (
                          <span className="text-ink-muted">{dict.executiveExport.notYetAvailable}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        </section>
      ) : null}

      <Card className="print:border-0 print:p-0 print:shadow-none">
        <CardHeader>
          <CardTitle>{dict.executiveExport.dataQualityPanel}</CardTitle>
        </CardHeader>
        <p className="text-sm text-ink-muted">{morningBrief.dataQuality.statusText}</p>
        {morningBrief.dataQuality.flaggedDocuments.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-xs text-status-warning">
            {morningBrief.dataQuality.flaggedDocuments.map((d, i) => (
              <li key={i}>
                {reportTypeLabel(d.reportType, dict.reportsCommon.reportTypes)}: {Math.round(d.completenessScore * 100)}%
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 border-t border-ink/10 pt-3">
          <h3 className="text-xs font-medium uppercase text-ink-muted">{dict.executiveExport.consistencyChecks}</h3>
          {consistencyAlerts.length === 0 ? (
            <p className="mt-1 text-xs text-ink-muted">{dict.executiveExport.noConsistencyIssues}</p>
          ) : (
            <>
              <ul className="mt-1 space-y-1 text-xs text-status-warning">
                {consistencyAlerts.map((a) => (
                  <li key={a.id}>{locale === 'ar' ? a.messageAr : a.messageEn}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-muted">{dict.executiveExport.correctionsNote}</p>
            </>
          )}
        </div>
      </Card>

      {morningBrief.todayActions.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold uppercase text-ink-muted">{dict.executiveExport.recommendedActions}</h2>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
            {morningBrief.todayActions.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-t border-ink/10 pt-4 text-sm text-ink-muted">
        <p className="mt-1">
          {sourceDocuments.length > 0
            ? dict.executiveExport.sourceReportsSummary
                .replace('{count}', String(sourceDocuments.length))
                .replace('{types}', sourceTypesSummary)
            : `${dict.executiveExport.sourceReports}: ${dict.comparisons.notAvailable}`}
        </p>
        {sourceFilenames.length > 0 ? (
          <details className="group mt-2">
            <summary className="cursor-pointer text-xs text-ink-muted marker:content-none">
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" className="h-3 w-3 transition-transform group-open:rotate-90 rtl:group-open:-rotate-90" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                  <path d="M7 4.5 12.5 10 7 15.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {dict.executiveExport.rawFilenamesToggle}
              </span>
            </summary>
            <p className="mt-1.5 text-xs">{sourceFilenames.join(', ')}</p>
          </details>
        ) : null}
      </section>
    </div>
  );
}
