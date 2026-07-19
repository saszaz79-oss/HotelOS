import type { getMetricsForDate } from '@/server/modules/metrics/queries';
import type { getLatestInsight } from './queries';

type Metrics = Awaited<ReturnType<typeof getMetricsForDate>>;
type Insight = Awaited<ReturnType<typeof getLatestInsight>>;

export interface MorningBrief {
  lines: string[];
}

const KEY_KEYS = ['occupancy_pct', 'adr', 'revpar'] as const;

function fmt(value: number, unit: string | undefined): string {
  return unit === 'percentage' ? `${value}%` : String(value);
}

function trendPhrase(current: number, previous: number, locale: 'ar' | 'en'): string {
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) return locale === 'ar' ? 'دون تغيير عن التقرير السابق' : 'unchanged from the previous report';
  const up = delta > 0;
  if (locale === 'ar') {
    return `${up ? 'ارتفاع' : 'انخفاض'} بمقدار ${Math.abs(delta)} عن التقرير السابق`;
  }
  return `${up ? 'up' : 'down'} ${Math.abs(delta)} from the previous report`;
}

/**
 * Deterministic Morning Brief — never calls an AI provider, never fails,
 * never fabricates a value. Built entirely from already-persisted,
 * human-reviewed HotelMetric/Insight rows using fixed templates, so it
 * stays available exactly when the AI Executive Summary can't be (no
 * provider configured, provider error, or simply as a faster-to-scan
 * companion to it) — the fallback the AI summary itself explicitly lacks.
 */
export function buildMorningBrief(input: {
  hotelName: string;
  locale: 'ar' | 'en';
  latestDate: Date;
  metrics: Metrics;
  previousMetrics: Metrics;
  insight: Insight;
}): MorningBrief {
  const { hotelName, locale, latestDate, metrics, previousMetrics, insight } = input;
  const byKey = new Map(metrics.map((m) => [m.metricKey, m]));
  const prevByKey = new Map(previousMetrics.map((m) => [m.metricKey, m]));
  const dateStr = latestDate.toLocaleDateString(locale);

  const lines: string[] = [];

  lines.push(
    locale === 'ar' ? `موجز الصباح — ${hotelName} — ${dateStr}` : `Morning Brief — ${hotelName} — ${dateStr}`
  );

  const metricLines: string[] = [];
  for (const key of KEY_KEYS) {
    const m = byKey.get(key);
    if (!m || m.value === null) continue;
    const label = locale === 'ar' ? m.metricDefinition.labelAr : m.metricDefinition.labelEn;
    const valueStr = fmt(m.value, m.metricDefinition.unit);
    const prev = prevByKey.get(key);
    const trend = prev && prev.value !== null ? ` (${trendPhrase(m.value, prev.value, locale)})` : '';
    metricLines.push(`${label}: ${valueStr}${trend}`);
  }
  if (metricLines.length > 0) {
    lines.push(...metricLines);
  } else {
    lines.push(locale === 'ar' ? 'لا توجد مؤشرات رئيسية متاحة لهذا التقرير.' : 'No key metrics available for this report.');
  }

  const openAlerts = insight?.alerts.length ?? 0;
  if (openAlerts > 0) {
    lines.push(
      locale === 'ar'
        ? `${openAlerts} تنبيه(ات) مفتوحة تحتاج إلى المراجعة.`
        : `${openAlerts} open alert${openAlerts === 1 ? '' : 's'} need attention.`
    );
  } else {
    lines.push(locale === 'ar' ? 'لا توجد تنبيهات مفتوحة.' : 'No open alerts.');
  }

  const topRecommendation = insight?.recommendations[0];
  if (topRecommendation) {
    const text = locale === 'ar' ? topRecommendation.textAr : topRecommendation.textEn;
    lines.push(locale === 'ar' ? `أولوية اليوم: ${text}` : `Today's priority: ${text}`);
  }

  return { lines };
}
