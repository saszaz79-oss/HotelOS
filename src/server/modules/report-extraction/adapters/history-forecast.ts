import type { ExtractionAdapter, RawExtractionResult } from '../types';

const TITLE_MARKERS = /history\s*(&|and)?\s*forecast/i;

/**
 * Type-detection-only adapter (EDI Phase 1) — see reservation-statistics.ts
 * for the pattern this mirrors. "History & Forecast" has no known Opera
 * field layout in this codebase at all (never seen a real sample), so
 * building a field-level adapter now would mean guessing at a format —
 * exactly the kind of unverified assumption the project's constitution
 * forbids. This only records the correct `reportType`; real extraction
 * waits for a real sample report.
 */
export const historyForecastAdapter: ExtractionAdapter = {
  reportType: 'HISTORY_FORECAST',

  detect(fullText: string): number {
    return TITLE_MARKERS.test(fullText) ? 0.85 : 0;
  },

  extract(): RawExtractionResult {
    return {
      fields: [],
      detectedReportDate: null,
      typeConfidence: 0.85,
      parserWarnings: ['History & Forecast report type recognized, but structured field extraction is not yet implemented. Manual entry only.'],
    };
  },
};
