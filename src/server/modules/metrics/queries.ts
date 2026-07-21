import { cache } from 'react';
import { prisma } from '@/lib/prisma';

/**
 * CQRS convention (Architecture §28): reads only.
 *
 * `cache()`-wrapped: Mission Control fetches this itself and also triggers
 * generateExecutiveSummary(), which independently re-fetches the exact same
 * value for the exact same hotelId — request-scoped memoization collapses
 * that back to one query (M7 performance audit).
 */
export const getLatestMetricDate = cache(async (hotelId: string): Promise<Date | null> => {
  const latest = await prisma.hotelMetric.findFirst({
    where: { hotelId },
    orderBy: { metricDate: 'desc' },
    select: { metricDate: true },
  });
  return latest?.metricDate ?? null;
});

/**
 * Metrics for a date, with provenance/quality joined in (Data Quality Engine,
 * Architecture §33) — every value on Mission Control must be able to show
 * its confidence, completeness, source report, and report date (PRD §6).
 *
 * `cache()`-wrapped for the same reason as `getLatestMetricDate` above:
 * Mission Control fetches this directly for `metrics` and also triggers
 * generateExecutiveSummary(), which independently re-fetches the identical
 * (hotelId, date) pair for `citedMetrics` — this is the heavier of the two
 * duplicated queries (a join across metricDefinition + sourceReportDocument
 * + reportUpload), so deduping it is the higher-value half of the M7 fix
 * documented on getLatestMetricDate (Perf sprint, M14).
 */
// `sourceReportDocument` is a narrow `select`, not `include: true` — every
// caller (Mission Control, Comparisons) only ever reads completenessScore,
// extractionConfidence, and the source filename; the prior `include` also
// pulled rawExtractedText/qualityNotes/parserWarnings/extractedFields for
// every metric row returned, none of which any consumer touches (Perf
// sprint round 2).
export const getMetricsForDate = cache(async (hotelId: string, date: Date) => {
  return prisma.hotelMetric.findMany({
    where: { hotelId, metricDate: date },
    include: {
      metricDefinition: true,
      sourceReportDocument: {
        select: {
          completenessScore: true,
          extractionConfidence: true,
          reportUpload: { select: { originalFilename: true } },
        },
      },
    },
  });
});

/** Most recent metricDate strictly before `beforeDate` — powers the Morning Brief's day-over-day trend and Comparisons' "vs previous". `cache()`-wrapped since Comparisons and Mission Control both derive it from the same `latestDate` within one request. */
export const getPreviousMetricDate = cache(async (hotelId: string, beforeDate: Date): Promise<Date | null> => {
  const prev = await prisma.hotelMetric.findFirst({
    where: { hotelId, metricDate: { lt: beforeDate } },
    orderBy: { metricDate: 'desc' },
    select: { metricDate: true },
  });
  return prev?.metricDate ?? null;
});

export const getMetricsForDateRange = cache(async (hotelId: string, from: Date, to: Date) => {
  return prisma.hotelMetric.findMany({
    where: { hotelId, metricDate: { gte: from, lte: to } },
    include: { metricDefinition: true },
    orderBy: { metricDate: 'asc' },
  });
});

/** Distinct metric keys with at least one real recorded value — backs the Comparisons page's metric selector, so it never offers a metric this hotel has no history for. */
export const listAvailableMetricKeys = cache(async (hotelId: string) => {
  const rows = await prisma.hotelMetric.findMany({
    where: { hotelId, value: { not: null } },
    distinct: ['metricKey'],
    select: { metricKey: true, metricDefinition: { select: { labelEn: true, labelAr: true, unit: true } } },
  });
  return rows.map((r) => ({ key: r.metricKey, labelEn: r.metricDefinition.labelEn, labelAr: r.metricDefinition.labelAr, unit: r.metricDefinition.unit }));
});
