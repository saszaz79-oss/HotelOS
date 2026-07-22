import type { ExtractionAdapter, RawExtractionResult } from '../types';

const TITLE_MARKERS = /day\s*[\/-]?\s*mtd\s*[\/-]?\s*ytd|month.to.date.*year.to.date/i;

/**
 * Type-detection-only adapter (EDI Phase 1) — see reservation-statistics.ts
 * for the pattern this mirrors. "Day MTD YTD Statistics" has no known Opera
 * field layout in this codebase (never seen a real sample). Only records
 * the correct `reportType`; real extraction waits for a real sample report.
 */
export const dayMtdYtdStatisticsAdapter: ExtractionAdapter = {
  reportType: 'DAY_MTD_YTD_STATISTICS',

  detect(fullText: string): number {
    return TITLE_MARKERS.test(fullText) ? 0.85 : 0;
  },

  extract(): RawExtractionResult {
    return {
      fields: [],
      detectedReportDate: null,
      typeConfidence: 0.85,
      parserWarnings: ['Day/MTD/YTD Statistics report type recognized, but structured field extraction is not yet implemented. Manual entry only.'],
    };
  },
};
