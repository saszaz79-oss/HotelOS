import type { ExtractionAdapter, RawExtractionResult } from '../types';

const TITLE_MARKERS = /reservation\s*statistics/i;

/**
 * Type-detection-only adapter (EDI Phase 1) — Reservation Statistics has no
 * field-level extraction adapter yet (no verified Opera field layout to
 * build against), so this exists purely so `ReportDocument.reportType`
 * records the correct type instead of falling through to `GENERIC` like an
 * unrecognized file. Extraction behaves identically to the generic
 * fallback (zero structured fields, honest parser warning) — the Analysis
 * Session UI shows this slot as "uploaded — structured extraction pending",
 * never as validated. See `report-extraction/adapters/generic-fallback.ts`
 * for the pattern this mirrors.
 */
export const reservationStatisticsAdapter: ExtractionAdapter = {
  reportType: 'RESERVATION_STATISTICS',

  detect(fullText: string): number {
    return TITLE_MARKERS.test(fullText) ? 0.85 : 0;
  },

  extract(): RawExtractionResult {
    return {
      fields: [],
      detectedReportDate: null,
      typeConfidence: 0.85,
      parserWarnings: ['Reservation Statistics report type recognized, but structured field extraction is not yet implemented. Manual entry only.'],
    };
  },
};
