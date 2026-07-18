import type { ReportType } from '@prisma/client';

/**
 * Validation Phase (see docs/VALIDATION_REPORT.md, Constitution "Never Hide
 * Uncertainty"): a field is only ever "verified" once a human has confirmed
 * it. Deterministic pattern-matching, however confident-looking, stays
 * "needs_review" — this is deliberate, not a bug, given the adapter's
 * accuracy is unvalidated against real Opera exports (see the honesty note
 * in adapters/manager-flash.ts).
 */
export type FieldValidationStatus = 'verified' | 'needs_review' | 'unsupported' | 'missing' | 'ambiguous';

/** One candidate metric value pulled from a report, before user review (Architecture §7, §33). */
export interface ExtractedField {
  metricKey: string;
  labelEn: string;
  rawText: string | null;
  value: number | null;
  /** Adapter's own confidence in this specific field, 0-1. Set to 1 once a user corrects it. */
  confidence: number;
  /** Whether a user has manually corrected this field since extraction (feeds HotelMetric.isManuallyCorrected). */
  corrected?: boolean;
  /** 1-indexed PDF page the value was found on, when determinable. */
  sourcePage?: number | null;
  /** The raw text line/snippet the value was extracted from — an approximation of "section," since this adapter has no true document-structure detection (see Parser Documentation). */
  sourceSnippet?: string | null;
  /** True when more than one label pattern matched with a different value — the field is genuinely ambiguous, not just low-confidence. */
  ambiguous?: boolean;
  status: FieldValidationStatus;
}

export interface RawExtractionResult {
  fields: ExtractedField[];
  detectedReportDate: Date | null;
  /** Overall adapter confidence in the report-type match itself, 0-1. */
  typeConfidence: number;
  /** Non-fatal parser warnings surfaced to the Validation Workspace (Validation Phase §1/§3). */
  parserWarnings: string[];
}

export interface PdfPage {
  num: number;
  text: string;
}

/**
 * Extraction adapter interface (Architecture §7). One implementation per
 * supported report type; a new report type is added by implementing this
 * interface, not by modifying pipeline code.
 */
export interface ExtractionAdapter {
  reportType: ReportType;
  /** Cheap pre-check: does this text look like this adapter's report type? Returns 0-1 confidence. */
  detect(fullText: string): number;
  /** Full field extraction — only called once detect() has selected this adapter. */
  extract(fullText: string, pages: PdfPage[]): RawExtractionResult;
}
