import { cache } from 'react';
import { prisma } from '@/lib/prisma';

/** CQRS convention (Architecture §28): reads only. */
export const getLatestInsight = cache(async (hotelId: string) => {
  return prisma.insight.findFirst({
    where: { hotelId },
    orderBy: { insightDate: 'desc' },
    include: {
      alerts: { where: { status: 'open' }, orderBy: { severity: 'asc' } },
      recommendations: { where: { status: 'open' }, orderBy: { priority: 'asc' } },
    },
  });
});

/**
 * Exact-date lookup (Executive Decision Intelligence redesign) — distinct
 * from getLatestInsight above: that finds whichever Insight row is most
 * recent, which usually but not necessarily matches a caller's own
 * `latestDate` (from metrics/queries.ts's getLatestMetricDate). The AI
 * intelligence narrative call needs the Insight for the *exact* metric
 * date it's generating for, never an approximation.
 */
export const getInsightForDate = cache(async (hotelId: string, insightDate: Date) => {
  return prisma.insight.findUnique({
    where: { hotelId_insightDate: { hotelId, insightDate } },
    include: {
      alerts: { where: { status: 'open' }, orderBy: { severity: 'asc' } },
      recommendations: { where: { status: 'open' }, orderBy: { priority: 'asc' } },
    },
  });
});
