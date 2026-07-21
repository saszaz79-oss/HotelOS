import { getDictionary, locales, defaultLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/server/modules/auth/session';
import { getActiveMembership } from '@/server/modules/hotels/access';
import {
  getLatestMetricDate,
  getMetricsForDate,
  getPreviousMetricDate,
  getMetricsForDateRange,
  listAvailableMetricKeys,
} from '@/server/modules/metrics/queries';
import { formatMetricValue } from '@/lib/format-metric';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TrendChart } from '@/components/ui/TrendChart';
import { Button } from '@/components/ui/Button';
import { TableShell, tableHeadRowClass, tableHeadCellClass, tableRowClass, tableCellClass } from '@/components/ui/TableShell';

const filterFieldClass =
  'rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] px-3 py-2 text-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export default async function ComparisonsPage(
  props: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ metric?: string; range?: string }>;
  }
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  const membership = user && !user.isSuperAdmin ? await getActiveMembership(user.id) : null;
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
      <div className="max-w-3xl space-y-6">
        <h1 className="text-xl font-medium text-ink">{dict.comparisons.title}</h1>
        <EmptyState title={dict.comparisons.noMetricsYet} />
      </div>
    );
  }

  const [metrics, previousDate, availableMetrics] = await Promise.all([
    getMetricsForDate(hotelId, latestDate),
    getPreviousMetricDate(hotelId, latestDate),
    listAvailableMetricKeys(hotelId),
  ]);

  const range = searchParams.range === '30' ? 30 : 7;
  const selectedMetric = availableMetrics.some((m) => m.key === searchParams.metric)
    ? searchParams.metric!
    : availableMetrics[0]?.key;
  const rangeFrom = new Date(latestDate);
  rangeFrom.setDate(rangeFrom.getDate() - (range - 1));

  // previousMetrics and rangeMetrics have no data dependency on each other
  // (both derive from values already resolved above) — parallelized rather
  // than sequential awaits (Perf sprint round 2).
  const [previousMetrics, rangeMetrics] = await Promise.all([
    previousDate ? getMetricsForDate(hotelId, previousDate) : Promise.resolve([]),
    selectedMetric ? getMetricsForDateRange(hotelId, rangeFrom, latestDate) : Promise.resolve([]),
  ]);
  const previousByKey = new Map(previousMetrics.map((m) => [m.metricKey, m.value]));

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
    })
    .sort((a, b) => Math.abs(b.pctChange ?? -1) - Math.abs(a.pctChange ?? -1));

  const trendPoints = rangeMetrics
    .filter((m) => m.metricKey === selectedMetric && m.value !== null)
    .map((m) => ({ date: m.metricDate.toISOString().slice(0, 10), value: m.value as number }));
  const selectedMetricDef = availableMetrics.find((m) => m.key === selectedMetric);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-medium text-ink">{dict.comparisons.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{dict.comparisons.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{dict.comparisons.todayVsPrevious}</CardTitle>
        </CardHeader>
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
                  <td className={`metric-value ${tableCellClass} text-ink`}>{formatMetricValue(r.current, r.unit)}</td>
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
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.comparisons.trend}</CardTitle>
        </CardHeader>
        {availableMetrics.length === 0 ? (
          <TrendChart points={[]} formatValue={() => ''} formatDate={() => ''} emptyLabel={dict.comparisons.notAvailable} />
        ) : (
          <>
            <form className="mb-4 flex flex-wrap gap-2" action={`/${locale}/comparisons`}>
              <select name="metric" defaultValue={selectedMetric} className={filterFieldClass}>
                {availableMetrics.map((m) => (
                  <option key={m.key} value={m.key}>
                    {locale === 'ar' ? m.labelAr : m.labelEn}
                  </option>
                ))}
              </select>
              <select name="range" defaultValue={String(range)} className={filterFieldClass}>
                <option value="7">{dict.comparisons.range7}</option>
                <option value="30">{dict.comparisons.range30}</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                {dict.reportsArchive.search}
              </Button>
            </form>
            <TrendChart
              points={trendPoints}
              formatValue={(v) => formatMetricValue(v, selectedMetricDef?.unit)}
              formatDate={(iso) => new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
              emptyLabel={dict.comparisons.notAvailable}
            />
          </>
        )}
      </Card>
    </div>
  );
}
