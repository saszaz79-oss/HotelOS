import { cache } from 'react';
import type { Prisma } from '@prisma/client';
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

/**
 * Most recent `limit` distinct metricDates for a hotel, newest first — pairs
 * with `getMetricsForDates` so "latest vs previous" (Mission Control,
 * Executive Export) costs 2 round trips total instead of 3
 * (getLatestMetricDate + getPreviousMetricDate + two separate
 * getMetricsForDate calls), removing the previousDate round trip entirely
 * (Perf sprint round 2).
 */
export const getRecentMetricDates = cache(async (hotelId: string, limit: number): Promise<Date[]> => {
  const rows = await prisma.hotelMetric.findMany({
    where: { hotelId },
    distinct: ['metricDate'],
    orderBy: { metricDate: 'desc' },
    take: limit,
    select: { metricDate: true },
  });
  return rows.map((r) => r.metricDate);
});

/** Metrics for several dates in one round trip — same include shape as getMetricsForDate, for callers needing more than one date (e.g. latest + previous) without a separate query per date. */
export const getMetricsForDates = cache(async (hotelId: string, dates: Date[]) => {
  if (dates.length === 0) return [];
  return prisma.hotelMetric.findMany({
    where: { hotelId, metricDate: { in: dates } },
    include: {
      metricDefinition: true,
      sourceReportDocument: {
        select: {
          reportType: true,
          completenessScore: true,
          extractionConfidence: true,
          reportUpload: { select: { originalFilename: true } },
        },
      },
    },
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

/** Every MetricDefinition (key/label/unit only) — the whole table is small and static, so a single unfiltered fetch is cheap. Powers label/unit lookups for keys referenced indirectly (e.g. a Recommendation's supportingMetrics JSON), where the metricDate on the JSON entry may not match any date already loaded on the page. */
export const getAllMetricDefinitions = cache(async () => {
  return prisma.metricDefinition.findMany({
    select: { key: true, labelEn: true, labelAr: true, unit: true },
  });
});

/**
 * Post-finalize correction history (Analytics fix, Phase 4) — read from the
 * existing AuditLog table (action: 'metric.manual_correction'), not a
 * dedicated table, matching the "reuse existing infrastructure, no schema
 * change" approach for this feature. Filtered via Postgres JSON-path
 * conditions on AuditLog.metadata; only ever called for the small number of
 * metrics a consistency check actually flagged, never for every KPI on the
 * page.
 */
const CORRECTION_HISTORY_SELECT = {
  id: true,
  createdAt: true,
  metadata: true,
  user: { select: { displayName: true } },
} satisfies Prisma.AuditLogSelect;

type MetricCorrectionRow = Prisma.AuditLogGetPayload<{ select: typeof CORRECTION_HISTORY_SELECT }>;

/**
 * Every flagged metric key's correction history for one date, in a single
 * round trip (Zero-Lag Sprint) — Mission Control previously ran one AuditLog
 * query per flagged key via `Promise.all`; N sequential round trips is a
 * real cost regardless of connection-pool concurrency, unlike a Promise.all
 * reorder alone. A single `metadata.metricKey IN (...)`-style OR clause
 * replaces all of them.
 */
export const getMetricCorrectionHistoryForKeys = cache(async (hotelId: string, metricDate: Date, metricKeys: string[]) => {
  if (metricKeys.length === 0) return new Map<string, MetricCorrectionRow[]>();

  const rows = await prisma.auditLog.findMany({
    where: {
      hotelId,
      action: 'metric.manual_correction',
      metadata: { path: ['metricDate'], equals: metricDate.toISOString() },
      OR: metricKeys.map((key) => ({ metadata: { path: ['metricKey'], equals: key } })),
    },
    orderBy: { createdAt: 'desc' },
    select: CORRECTION_HISTORY_SELECT,
  });

  const byKey = new Map<string, MetricCorrectionRow[]>();
  for (const row of rows) {
    const meta = row.metadata as Record<string, unknown> | null;
    const key = typeof meta?.metricKey === 'string' ? meta.metricKey : null;
    if (!key) continue;
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      byKey.set(key, [row]);
    }
  }
  return byKey;
});

export interface ParsedMetricCorrection {
  id: string;
  correctedByDisplayName: string;
  createdAt: Date;
  previousValue: number | null;
  newValue: number | null;
  reason: string | null;
}

/** Defensive JSON parsing (AuditLog.metadata is an untyped Json column) — never fabricates a value it can't confirm, shows null/omits instead. */
export function parseMetricCorrectionHistory(rows: MetricCorrectionRow[]): ParsedMetricCorrection[] {
  return rows.map((r) => {
    const meta = r.metadata as Record<string, unknown> | null;
    return {
      id: r.id,
      correctedByDisplayName: r.user.displayName,
      createdAt: r.createdAt,
      previousValue: typeof meta?.previousValue === 'number' ? meta.previousValue : null,
      newValue: typeof meta?.newValue === 'number' ? meta.newValue : null,
      reason: typeof meta?.reason === 'string' ? meta.reason : null,
    };
  });
}
