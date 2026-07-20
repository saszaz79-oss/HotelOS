import type { getMetricsForDate } from '@/server/modules/metrics/queries';
import { formatMetricValue } from '@/lib/format-metric';
import type { getLatestInsight } from './queries';

type Metrics = Awaited<ReturnType<typeof getMetricsForDate>>;
type Insight = Awaited<ReturnType<typeof getLatestInsight>>;

export interface MorningBriefKeyNumber {
  label: string;
  value: string;
  trend: string | null;
}

/**
 * Structured to match the required section set (Enterprise v2 Phase 10)
 * exactly — todaySummary/keyNumbers/whatChanged/risks/opportunities/
 * todayActions/priority/suggestedOwner/dataStatus — instead of a flat
 * line list, so the UI can render each as its own labeled block.
 */
export interface MorningBrief {
  todaySummary: string;
  keyNumbers: MorningBriefKeyNumber[];
  whatChanged: string[];
  risks: string[];
  opportunities: string[];
  todayActions: string[];
  priority: string | null;
  suggestedOwner: string | null;
  dataStatus: string;
}

const KEY_KEYS = ['occupancy_pct', 'adr', 'revpar'] as const;

// Coarse, deterministic role inference from which real metrics fed a
// recommendation (Recommendation.supportingMetrics) — not a stored fact
// (no schema field for "owner" exists), so this is re-derived at display
// time rather than fabricated once and persisted as if it were data.
const REVENUE_METRIC_KEYS = new Set(['occupancy_pct', 'adr', 'revpar', 'room_revenue', 'total_revenue']);
const FRONT_OFFICE_METRIC_KEYS = new Set(['open_balance', 'arrivals', 'departures', 'stayovers', 'no_shows', 'cancellations']);

function inferSuggestedOwner(supportingMetrics: unknown): string | null {
  if (!Array.isArray(supportingMetrics)) return null;
  const keys = supportingMetrics
    .map((m) => (m && typeof m === 'object' && 'metricKey' in m ? String((m as { metricKey: unknown }).metricKey) : null))
    .filter((k): k is string => k !== null);
  if (keys.some((k) => REVENUE_METRIC_KEYS.has(k))) return 'REVENUE_MANAGER';
  if (keys.some((k) => FRONT_OFFICE_METRIC_KEYS.has(k))) return 'FRONT_OFFICE_MANAGER';
  return keys.length > 0 ? 'GENERAL_MANAGER' : null;
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
  avgDataQuality: number | null;
}): MorningBrief {
  const { hotelName, locale, latestDate, metrics, previousMetrics, insight, avgDataQuality } = input;
  const byKey = new Map(metrics.map((m) => [m.metricKey, m]));
  const prevByKey = new Map(previousMetrics.map((m) => [m.metricKey, m]));
  const dateStr = latestDate.toLocaleDateString(locale);

  const keyNumbers: MorningBriefKeyNumber[] = [];
  const whatChanged: string[] = [];
  for (const key of KEY_KEYS) {
    const m = byKey.get(key);
    if (!m || m.value === null) continue;
    const label = locale === 'ar' ? m.metricDefinition.labelAr : m.metricDefinition.labelEn;
    const valueStr = formatMetricValue(m.value, m.metricDefinition.unit);
    const prev = prevByKey.get(key);
    const trend = prev && prev.value !== null ? trendPhrase(m.value, prev.value, locale) : null;
    keyNumbers.push({ label, value: valueStr, trend });
    if (trend && prev!.value !== m.value) {
      whatChanged.push(`${label}: ${trend}`);
    }
  }
  if (whatChanged.length === 0) {
    whatChanged.push(
      previousMetrics.length === 0
        ? locale === 'ar'
          ? 'لا توجد بيانات من تقرير سابق للمقارنة.'
          : 'No previous report to compare against yet.'
        : locale === 'ar'
        ? 'لا توجد تغييرات ملحوظة عن التقرير السابق.'
        : 'No notable changes from the previous report.'
    );
  }

  const occ = byKey.get('occupancy_pct');
  const adr = byKey.get('adr');
  let todaySummary: string;
  if (occ?.value !== null && occ !== undefined) {
    const occStr = formatMetricValue(occ.value, 'percentage');
    const adrStr = adr?.value !== null && adr !== undefined ? formatMetricValue(adr.value, 'currency') : null;
    todaySummary =
      locale === 'ar'
        ? `${hotelName} — ${dateStr}: نسبة الإشغال ${occStr}${adrStr ? ` بمتوسط سعر غرفة ${adrStr}` : ''}.`
        : `${hotelName} — ${dateStr}: occupancy at ${occStr}${adrStr ? ` with ADR at ${adrStr}` : ''}.`;
  } else {
    todaySummary =
      locale === 'ar' ? `${hotelName} — ${dateStr}: تقرير متاح دون بيانات إشغال.` : `${hotelName} — ${dateStr}: report available without occupancy data.`;
  }

  const risks = (insight?.alerts ?? [])
    .filter((a) => a.severity === 'critical' || a.severity === 'warning')
    .map((a) => (locale === 'ar' ? a.messageAr : a.messageEn));
  const riskRecommendations = (insight?.recommendations ?? []).filter((r) => r.category === 'risk');
  for (const r of riskRecommendations) {
    risks.push(locale === 'ar' ? r.textAr : r.textEn);
  }
  if (risks.length === 0) {
    risks.push(locale === 'ar' ? 'لا توجد مخاطر مرصودة حالياً.' : 'No risks currently flagged.');
  }

  const opportunities = (insight?.recommendations ?? [])
    .filter((r) => r.category === 'opportunity')
    .map((r) => (locale === 'ar' ? r.textAr : r.textEn));
  if (opportunities.length === 0) {
    opportunities.push(locale === 'ar' ? 'لا توجد فرص مرصودة حالياً.' : 'No opportunities currently flagged.');
  }

  const allRecommendations = insight?.recommendations ?? [];
  const todayActions = allRecommendations.map((r) => (locale === 'ar' ? r.suggestedActionAr : r.suggestedActionEn));

  const topRecommendation = allRecommendations[0];
  const priority = topRecommendation ? (locale === 'ar' ? topRecommendation.textAr : topRecommendation.textEn) : null;
  const suggestedOwner = topRecommendation ? inferSuggestedOwner(topRecommendation.supportingMetrics) : null;

  const dataStatus =
    avgDataQuality !== null
      ? locale === 'ar'
        ? `اكتمال البيانات ${Math.round(avgDataQuality * 100)}% لهذا التاريخ.`
        : `Data is ${Math.round(avgDataQuality * 100)}% complete for this date.`
      : locale === 'ar'
      ? 'لا تتوفر معلومات عن جودة البيانات لهذا التاريخ.'
      : 'No data-quality information available for this date.';

  return { todaySummary, keyNumbers, whatChanged, risks, opportunities, todayActions, priority, suggestedOwner, dataStatus };
}
