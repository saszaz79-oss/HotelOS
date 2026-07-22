import type { HotelRole, ReportType } from '@prisma/client';
import type { getMetricsForDates } from '@/server/modules/metrics/queries';
import { formatMetricValue } from '@/lib/format-metric';
import type { getLatestInsight } from './queries';

// Both real callers (Mission Control, Executive Export) pass metrics sourced
// from getMetricsForDates (Perf sprint round 2's batched latest+previous
// query), not the singular getMetricsForDate — this type must match that
// shape (specifically: sourceReportDocument.reportType, added Analytics fix
// Phase 1) or the dataQuality section below can't compile.
type Metrics = Awaited<ReturnType<typeof getMetricsForDates>>;
type Insight = Awaited<ReturnType<typeof getLatestInsight>>;

export interface MorningBriefKeyNumber {
  label: string;
  value: string;
  trend: string | null;
}

export interface MorningBriefFlaggedDocument {
  reportType: ReportType;
  completenessScore: number;
}

export interface MorningBriefDataQuality {
  scorePct: number | null;
  statusText: string;
  flaggedDocuments: MorningBriefFlaggedDocument[];
}

/**
 * Structured to match the required section set (Enterprise v2 Phase 10,
 * Analytics fix Phase 3) exactly — todaySummary/keyNumbers/whatChanged/
 * risks/opportunities/todayActions/priority/suggestedOwner/dataQuality —
 * instead of a flat line list, so the UI can render each as its own
 * labeled block. `dataQuality` replaced the earlier bare `dataStatus`
 * string with a first-class section (a completeness score alone wasn't
 * enough to act on — which specific source document is the weak link?).
 */
export interface MorningBrief {
  todaySummary: string;
  keyNumbers: MorningBriefKeyNumber[];
  whatChanged: string[];
  risks: string[];
  opportunities: string[];
  todayActions: string[];
  priority: string | null;
  suggestedOwner: HotelRole | null;
  dataQuality: MorningBriefDataQuality;
}

const KEY_KEYS = ['occupancy_pct', 'adr', 'revpar'] as const;

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
  currency?: string;
}): MorningBrief {
  const { hotelName, locale, latestDate, metrics, previousMetrics, insight, avgDataQuality, currency } = input;
  const byKey = new Map(metrics.map((m) => [m.metricKey, m]));
  const prevByKey = new Map(previousMetrics.map((m) => [m.metricKey, m]));
  const dateStr = latestDate.toLocaleDateString(locale);

  const keyNumbers: MorningBriefKeyNumber[] = [];
  const whatChanged: string[] = [];
  for (const key of KEY_KEYS) {
    const m = byKey.get(key);
    if (!m || m.value === null) continue;
    const label = locale === 'ar' ? m.metricDefinition.labelAr : m.metricDefinition.labelEn;
    const valueStr = formatMetricValue(m.value, m.metricDefinition.unit, currency);
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
    const adrStr = adr?.value !== null && adr !== undefined ? formatMetricValue(adr.value, 'currency', currency) : null;
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
  // Reads the real persisted column (Analytics fix Phase 6) instead of
  // re-deriving a guess from supportingMetrics on every render — null for
  // recommendations created before this migration, shown as unavailable
  // rather than backfilled with a heuristic.
  const suggestedOwner = topRecommendation?.owner ?? null;

  const statusText =
    avgDataQuality !== null
      ? locale === 'ar'
        ? `اكتمال البيانات ${Math.round(avgDataQuality * 100)}% لهذا التاريخ.`
        : `Data is ${Math.round(avgDataQuality * 100)}% complete for this date.`
      : locale === 'ar'
      ? 'لا تتوفر معلومات عن جودة البيانات لهذا التاريخ.'
      : 'No data-quality information available for this date.';

  // Below 0.8 completeness matches the existing "not positive-tier" threshold
  // used elsewhere (mission-control's dataQualityTone) — flagged here by the
  // real source document that's actually weak, not just an aggregate number
  // with nothing to act on.
  const FLAG_THRESHOLD = 0.8;
  const flaggedDocuments: MorningBriefFlaggedDocument[] = [];
  const seenFlagged = new Set<string>();
  for (const m of metrics) {
    const doc = m.sourceReportDocument;
    if (!doc || doc.completenessScore === null || doc.completenessScore >= FLAG_THRESHOLD) continue;
    const dedupeKey = `${doc.reportType}:${doc.completenessScore}`;
    if (seenFlagged.has(dedupeKey)) continue;
    seenFlagged.add(dedupeKey);
    flaggedDocuments.push({ reportType: doc.reportType, completenessScore: doc.completenessScore });
  }

  const dataQuality: MorningBriefDataQuality = {
    scorePct: avgDataQuality !== null ? Math.round(avgDataQuality * 100) : null,
    statusText,
    flaggedDocuments,
  };

  return { todaySummary, keyNumbers, whatChanged, risks, opportunities, todayActions, priority, suggestedOwner, dataQuality };
}
