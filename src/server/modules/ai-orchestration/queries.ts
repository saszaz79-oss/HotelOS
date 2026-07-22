import { cache } from 'react';
import { prisma } from '@/lib/prisma';

/**
 * Request-scoped read of a persisted AI Executive Summary (Perf fix, Phase
 * 1B) — the cache() dedup here is the same pattern as every other query
 * module in this codebase; staleness/regeneration is decided by the caller
 * (getOrRefreshExecutiveSummary in commands.ts), this is a plain read.
 */
export const getCachedExecutiveSummary = cache(
  async (hotelId: string, metricDate: Date, language: 'ar' | 'en') => {
    return prisma.aiExecutiveSummary.findUnique({
      where: { hotelId_metricDate_language: { hotelId, metricDate, language } },
    });
  }
);

/** Same pattern as getCachedExecutiveSummary above, for the Executive Decision Intelligence narrative (EDI redesign) — a plain read, staleness/regeneration decided by getOrRefreshExecutiveIntelligence in commands.ts. */
export const getCachedExecutiveIntelligence = cache(
  async (hotelId: string, metricDate: Date, language: 'ar' | 'en') => {
    return prisma.aiExecutiveIntelligence.findUnique({
      where: { hotelId_metricDate_language: { hotelId, metricDate, language } },
    });
  }
);
