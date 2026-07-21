import { redirect } from 'next/navigation';
import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import { getLatestMetricDate, getRecentMetricDates, getMetricsForDates } from '@/server/modules/metrics/queries';
import { getLatestInsight } from '@/server/modules/insights/queries';
import { buildMorningBrief } from '@/server/modules/insights/morning-brief';
import { generateExecutiveSummary } from '@/server/modules/ai-orchestration/commands';
import { recordExport } from '@/server/modules/exports/commands';
import { formatMetricValue } from '@/lib/format-metric';
import { reportTypeLabel } from '@/lib/report-type-label';
import { EmptyState } from '@/components/ui/EmptyState';
import { PrintButton } from './PrintButton';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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

  const [recentDates, insight] = await Promise.all([getRecentMetricDates(hotelId, 2), getLatestInsight(hotelId)]);
  const previousDate = recentDates[1] ?? null;
  const allMetrics = await getMetricsForDates(hotelId, recentDates);
  const metrics = allMetrics.filter((m) => m.metricDate.getTime() === latestDate.getTime());
  const previousMetrics = previousDate ? allMetrics.filter((m) => m.metricDate.getTime() === previousDate.getTime()) : [];
  const aiSummary = await generateExecutiveSummary(hotelId, locale, membership.hotel.name, { latestDate, metrics });
  const previousByKey = new Map(previousMetrics.map((m) => [m.metricKey, m.value]));

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

  await recordExport(hotelId, user.id, locale, latestDate);

  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-surface-raised p-8 text-ink print:max-w-none print:p-0">
      <div className="print-hide flex justify-end">
        <PrintButton label={dict.executiveExport.printAction} />
      </div>

      <header className="flex items-start justify-between gap-4 border-b border-ink/10 pb-4">
        <div>
          {membership.hotel.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={membership.hotel.logoUrl} alt="" className="mb-2 h-10 w-auto object-contain" />
          ) : null}
          <h1 className="text-xl font-semibold">{membership.hotel.name}</h1>
          <p className="text-sm text-ink-muted">{dict.executiveExport.title}</p>
        </div>
        <div className="text-end text-sm text-ink-muted">
          <p>
            {dict.executiveExport.businessDate}: {latestDate.toLocaleDateString(locale)}
          </p>
          <p>
            {dict.executiveExport.generatedAt}: {new Date().toLocaleString(locale)}
          </p>
        </div>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase text-ink-muted">{dict.executiveExport.executiveSummary}</h2>
        <p className="mt-1 text-sm">{morningBrief.todaySummary}</p>
        {aiSummary.ok ? (
          <p className="mt-2 text-sm text-ink-muted">{aiSummary.summary}</p>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">{dict.missionControl.aiSummaryUnavailable[aiSummary.reason]}</p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase text-ink-muted">{dict.executiveExport.kpis}</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-start text-ink-muted">
              <th className="py-1.5 text-start">{dict.comparisons.metric}</th>
              <th className="py-1.5 text-start">{dict.comparisons.current}</th>
              <th className="py-1.5 text-start">{dict.comparisons.previous}</th>
              <th className="py-1.5 text-start">{dict.comparisons.change}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-ink/5">
                <td className="py-1.5">{r.label}</td>
                <td className="metric-value py-1.5">{formatMetricValue(r.current, r.unit)}</td>
                <td className="metric-value py-1.5">
                  {r.previous !== null ? formatMetricValue(r.previous, r.unit) : dict.comparisons.notAvailable}
                </td>
                <td className="metric-value py-1.5">
                  {r.delta === null
                    ? dict.comparisons.notAvailable
                    : `${r.delta >= 0 ? '+' : ''}${formatMetricValue(r.delta, r.unit)}${
                        r.pctChange !== null ? ` (${r.pctChange >= 0 ? '+' : ''}${round1(r.pctChange)}%)` : ''
                      }`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase text-ink-muted">{dict.missionControl.brief.risks}</h2>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
            {morningBrief.risks.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase text-ink-muted">{dict.missionControl.brief.opportunities}</h2>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
            {morningBrief.opportunities.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      </section>

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
        <p>{morningBrief.dataStatus}</p>
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
