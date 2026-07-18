import type { ExtractedField, ExtractionAdapter, PdfPage, RawExtractionResult } from '../types';

/**
 * Manager Flash adapter (Architecture §7, Roadmap M3).
 *
 * IMPORTANT — honesty note (Constitution §1 truth test, §2 rule #1): this
 * adapter was built without a real sample Manager Flash PDF to calibrate
 * against (none was available in this environment). It implements
 * deterministic label→value pattern matching against label wording commonly
 * used in Opera Manager Flash exports, but its real-world accuracy is
 * UNVALIDATED. Every field it produces carries a confidence score, every
 * report it processes is routed to mandatory manual review (PRD §4), and
 * nothing it extracts is ever written to HotelMetric without user
 * confirmation (that write doesn't even exist yet — it's Roadmap M4). Do not
 * present this adapter as validated until it has been run against real
 * exports during the pilot (see Roadmap "Validation plan for v0.1").
 *
 * Field labels searched are intentionally permissive (multiple wording
 * variants per metric) precisely because layout is unvalidated — a stricter
 * pattern would silently extract nothing rather than surface a low-confidence
 * candidate for a human to check.
 */

interface FieldSpec {
  metricKey: string;
  labelEn: string;
  labels: RegExp[];
  /** Sanity range used to lower confidence (not reject) an implausible parse. */
  plausibleRange?: [number, number];
}

const NUMBER = String.raw`([\d,]+(?:\.\d+)?)\s*%?`;

function labelPattern(...variants: string[]): RegExp[] {
  return variants.map((v) => new RegExp(`${v}\\s*[:\\-]?\\s*${NUMBER}`, 'i'));
}

const FIELD_SPECS: FieldSpec[] = [
  { metricKey: 'occupancy_pct', labelEn: 'Occupancy %', labels: labelPattern('occ(?:upancy)?\\s*%?'), plausibleRange: [0, 100] },
  { metricKey: 'rooms_available', labelEn: 'Rooms Available', labels: labelPattern('rooms?\\s*avail(?:able)?') },
  { metricKey: 'rooms_sold', labelEn: 'Rooms Sold', labels: labelPattern('rooms?\\s*sold') },
  { metricKey: 'out_of_order_rooms', labelEn: 'Out of Order Rooms', labels: labelPattern('out\\s*of\\s*order', 'ooo') },
  { metricKey: 'arrivals', labelEn: 'Arrivals', labels: labelPattern('arrivals?') },
  { metricKey: 'departures', labelEn: 'Departures', labels: labelPattern('departures?') },
  { metricKey: 'stayovers', labelEn: 'Stayovers', labels: labelPattern('stay\\s*overs?', 'stayovers?') },
  { metricKey: 'no_shows', labelEn: 'No-Shows', labels: labelPattern('no[\\s-]*shows?') },
  { metricKey: 'cancellations', labelEn: 'Cancellations', labels: labelPattern('cancell?ations?') },
  { metricKey: 'room_revenue', labelEn: 'Room Revenue', labels: labelPattern('room\\s*revenue') },
  { metricKey: 'total_revenue', labelEn: 'Total Revenue', labels: labelPattern('total\\s*revenue') },
  { metricKey: 'adr', labelEn: 'ADR', labels: labelPattern('adr', 'average\\s*(?:daily\\s*)?rate') },
  { metricKey: 'revpar', labelEn: 'RevPAR', labels: labelPattern('rev\\s*par') },
  { metricKey: 'complimentary_rooms', labelEn: 'Complimentary Rooms', labels: labelPattern('comp(?:limentary)?\\s*rooms?') },
  { metricKey: 'house_use_rooms', labelEn: 'House Use Rooms', labels: labelPattern('house\\s*use') },
  { metricKey: 'adults', labelEn: 'Adults', labels: labelPattern('adults?') },
  { metricKey: 'children', labelEn: 'Children', labels: labelPattern('child(?:ren)?') },
  { metricKey: 'total_guests', labelEn: 'Total Guests', labels: labelPattern('total\\s*guests?', 'guest\\s*count') },
];

function parseNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

function findPage(pages: PdfPage[], snippet: string): number | null {
  const page = pages.find((p) => p.text.includes(snippet));
  return page?.num ?? null;
}

function lineContaining(fullText: string, snippet: string): string | null {
  const line = fullText.split('\n').find((l) => l.includes(snippet));
  return line?.trim() ?? null;
}

/**
 * Searches ALL label variants (not just the first match) so genuine
 * ambiguity — two different label phrasings matching two different values —
 * is surfaced rather than silently resolved by pattern order (Validation
 * Phase §2: an "ambiguous" status must reflect real ambiguity in the source
 * text, not an artifact of which regex happened to run first).
 */
function extractField(fullText: string, pages: PdfPage[], spec: FieldSpec): ExtractedField {
  const matches = spec.labels
    .map((pattern) => fullText.match(pattern))
    .filter((m): m is RegExpMatchArray => m !== null && m[1] !== undefined);

  if (matches.length === 0) {
    return { metricKey: spec.metricKey, labelEn: spec.labelEn, rawText: null, value: null, confidence: 0, status: 'missing' };
  }

  const distinctValues = Array.from(new Set(matches.map((m) => parseNumber(m[1]!))));
  const ambiguous = distinctValues.length > 1;
  const match = matches[0]!;
  const value = parseNumber(match[1]!);

  let confidence = 0.6; // deterministic label match, but layout unvalidated (see module doc comment)
  if (spec.plausibleRange) {
    const [min, max] = spec.plausibleRange;
    confidence = value >= min && value <= max ? 0.6 : 0.25;
  }

  return {
    metricKey: spec.metricKey,
    labelEn: spec.labelEn,
    rawText: match[0],
    value,
    confidence,
    sourcePage: findPage(pages, match[0]),
    sourceSnippet: lineContaining(fullText, match[0]),
    ambiguous,
    // Nothing is "verified" from automatic extraction alone (Constitution
    // "Never Hide Uncertainty") — everything found lands as needs_review
    // until a human confirms it, except genuinely ambiguous matches which
    // get their own status so a reviewer knows to look harder.
    status: ambiguous ? 'ambiguous' : 'needs_review',
  };
}

const TITLE_MARKERS = /manager'?s?\s*flash/i;

export const managerFlashAdapter: ExtractionAdapter = {
  reportType: 'MANAGER_FLASH',

  detect(fullText) {
    if (TITLE_MARKERS.test(fullText)) return 0.9;
    const hits = FIELD_SPECS.filter((spec) => spec.labels.some((p) => p.test(fullText))).length;
    return Math.min(0.7, hits / FIELD_SPECS.length);
  },

  extract(fullText, pages): RawExtractionResult {
    const fields = FIELD_SPECS.map((spec) => extractField(fullText, pages, spec));

    const dateMatch = fullText.match(/\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/);
    const detectedReportDate = dateMatch?.[1] ? parseLooseDate(dateMatch[1]) : null;

    const foundCount = fields.filter((f) => f.value !== null).length;
    const typeConfidence = TITLE_MARKERS.test(fullText) ? 0.9 : Math.min(0.7, foundCount / fields.length);

    const parserWarnings: string[] = [];
    if (!TITLE_MARKERS.test(fullText)) {
      parserWarnings.push('Report title marker "Manager\'s Flash" not found — type match is based on field-label heuristics only.');
    }
    if (!dateMatch) {
      parserWarnings.push('No date pattern found in report text — report date must be entered manually.');
    }
    const ambiguousFields = fields.filter((f) => f.ambiguous);
    if (ambiguousFields.length > 0) {
      parserWarnings.push(`${ambiguousFields.length} field(s) matched multiple conflicting values: ${ambiguousFields.map((f) => f.labelEn).join(', ')}.`);
    }

    return { fields, detectedReportDate, typeConfidence, parserWarnings };
  },
};

function parseLooseDate(raw: string): Date | null {
  const parts = raw.split(/[\/\-.]/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [a, b, year4] = parts;
  if (a === undefined || b === undefined || year4 === undefined) return null;
  const year = year4 < 100 ? 2000 + year4 : year4;

  // Day/month order (DD/MM vs MM/DD) is ambiguous from the text alone.
  // Never guess when both values could be either (Constitution: never invent
  // — an auto-picked wrong date would silently corrupt the HotelMetric date
  // key later). Only resolve when exactly one value is >12 and therefore
  // unambiguously the day.
  let day: number;
  let month: number;
  if (a > 12 && b <= 12) {
    day = a;
    month = b;
  } else if (b > 12 && a <= 12) {
    day = b;
    month = a;
  } else {
    return null; // ambiguous or both invalid — caller must confirm manually (PRD §4)
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}
