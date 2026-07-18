import type { ExtractionAdapter, RawExtractionResult } from '../types';

/**
 * Generic fallback (Architecture §7): unrecognized PDFs get raw text stored
 * for reference, but no structured field mapping is attempted — the UI must
 * mark these "unstructured — manual entry only" rather than implying
 * automatic extraction happened.
 */
export const genericFallbackAdapter: ExtractionAdapter = {
  reportType: 'GENERIC',

  detect() {
    // Always matches, at minimal confidence — selected only when no
    // type-specific adapter scores higher (see adapters/index.ts).
    return 0.05;
  },

  extract(): RawExtractionResult {
    return {
      fields: [],
      detectedReportDate: null,
      typeConfidence: 0.05,
      parserWarnings: ['No adapter matched this report — all fields are unsupported for automatic extraction. Manual entry only.'],
    };
  },
};
