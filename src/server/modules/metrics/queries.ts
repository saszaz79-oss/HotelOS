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
 */
export async function getMetricsForDate(hotelId: string, date: Date) {
  return prisma.hotelMetric.findMany({
    where: { hotelId, metricDate: date },
    include: {
      metricDefinition: true,
      sourceReportDocument: { include: { reportUpload: { select: { originalFilename: true } } } },
    },
  });
}

/** Most recent metricDate strictly before `beforeDate` — powers the Morning Brief's day-over-day trend, no other consumer needed this yet. */
export async function getPreviousMetricDate(hotelId: string, beforeDate: Date): Promise<Date | null> {
  const prev = await prisma.hotelMetric.findFirst({
    where: { hotelId, metricDate: { lt: beforeDate } },
    orderBy: { metricDate: 'desc' },
    select: { metricDate: true },
  });
  return prev?.metricDate ?? null;
}

export async function getMetricsForDateRange(hotelId: string, from: Date, to: Date) {
  return prisma.hotelMetric.findMany({
    where: { hotelId, metricDate: { gte: from, lte: to } },
    include: { metricDefinition: true },
    orderBy: { metricDate: 'asc' },
  });
}

/** Distinct metric keys with at least one real recorded value — backs the Comparisons page's metric selector, so it never offers a metric this hotel has no history for. */
export async function listAvailableMetricKeys(hotelId: string) {
  const rows = await prisma.hotelMetric.findMany({
    where: { hotelId, value: { not: null } },
    distinct: ['metricKey'],
    select: { metricKey: true, metricDefinition: { select: { labelEn: true, labelAr: true, unit: true } } },
  });
  return rows.map((r) => ({ key: r.metricKey, labelEn: r.metricDefinition.labelEn, labelAr: r.metricDefinition.labelAr, unit: r.metricDefinition.unit }));
}
