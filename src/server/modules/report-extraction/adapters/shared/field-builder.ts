import type { ExtractedField } from '../../types';

/**
 * Shared field-construction helpers (EDI Phase 2.5 modular adapter
 * architecture) — every adapter builds its `ExtractedField[]` through
 * these so confidence scoring, evidence preservation, and the "nothing is
 * ever verified from automatic extraction alone" rule stay identical
 * across report types, per the Constitution's "Never Hide Uncertainty"
 * principle. A new adapter gets this behavior for free; it never
 * re-implements confidence/evidence logic itself.
 */

export interface FieldMatch {
  metricKey: string;
  labelEn: string;
  sourceLabel: string;
  rawText: string;
  value: number;
  sourcePage: number | null;
  sourceSnippet: string | null;
  /** Sanity range — a value outside this lowers confidence but is never rejected/hidden (an implausible extraction is still real evidence something needs a human look, not a reason to pretend nothing was found). */
  plausibleRange?: [number, number];
}

const BASE_CONFIDENCE = 0.75; // matched via a real, structurally-anchored positional parse (not a loose proximity regex) — higher baseline than the pre-Phase-2.5 adapter's 0.6, and justified by the parser actually being verified against real samples.
const IMPLAUSIBLE_CONFIDENCE = 0.3;

export function buildMatchedField(match: FieldMatch): ExtractedField {
  let confidence = BASE_CONFIDENCE;
  if (match.plausibleRange) {
    const [min, max] = match.plausibleRange;
    confidence = match.value >= min && match.value <= max ? BASE_CONFIDENCE : IMPLAUSIBLE_CONFIDENCE;
  }

  return {
    metricKey: match.metricKey,
    labelEn: match.labelEn,
    sourceLabel: match.sourceLabel,
    rawText: match.rawText,
    value: match.value,
    confidence,
    sourcePage: match.sourcePage,
    sourceSnippet: match.sourceSnippet,
    // Nothing is "verified" from automatic extraction alone — every match
    // lands as needs_review until a human confirms it (Constitution "Never
    // Hide Uncertainty"), same rule the original Manager Flash adapter
    // already followed.
    status: 'needs_review',
  };
}

export function buildMissingField(metricKey: string, labelEn: string): ExtractedField {
  return { metricKey, labelEn, rawText: null, value: null, confidence: 0, status: 'missing' };
}

/**
 * Loose DD/MM/YYYY-or-similar date parser shared by every adapter (moved
 * out of manager-flash.ts, behavior unchanged) — day/month order is
 * genuinely ambiguous in a bare numeric date, so this only resolves when
 * exactly one of the two values is unambiguously > 12 (i.e. can only be a
 * day). Never guesses when both readings are plausible — a wrong auto-pick
 * would silently corrupt the HotelMetric date key downstream, which is
 * worse than asking a human to confirm it (PRD §4, Constitution: never invent).
 */
export function parseLooseDate(raw: string): Date | null {
  const parts = raw.split(/[/\-.]/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [a, b, year4] = parts;
  if (a === undefined || b === undefined || year4 === undefined) return null;
  const year = year4 < 100 ? 2000 + year4 : year4;

  let day: number;
  let month: number;
  if (a > 12 && b <= 12) {
    day = a;
    month = b;
  } else if (b > 12 && a <= 12) {
    day = b;
    month = a;
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}
