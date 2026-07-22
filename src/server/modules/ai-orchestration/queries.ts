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
