import type { ExtractedField, ExtractionAdapter, PdfPage, RawExtractionResult } from '../types';
import { splitLines, splitLabelValueBlock, zipLabelsToValues, type ZippedValue } from './shared/block-parser';
import { buildMatchedField, buildMissingField, parseLooseDate } from './shared/field-builder';

/**
 * Manager Flash adapter (EDI Phase 2.5 rewrite).
 *
 * IMPORTANT — this replaces a proximity-regex implementation ("label
 * immediately followed by its number") that was built without a real
 * sample and, once a real Manager Flash export was finally available to
 * test against, turned out not to match the actual layout AT ALL: Opera
 * emits every label as its own line in one contiguous block, then every
 * value as a separate line in a second contiguous block further down the
 * page — the two are never adjacent in the extracted text. A regex
 * expecting "label ... number" right next to each other would fail to
 * match almost every field against a real export. This was found and
 * fixed during this phase, not shipped and left broken.
 *
 * Real layout (verified against a real sample, both pages):
 *   <label line 1>
 *   <label line 2>
 *   ...
 *   2026 2026 2026        <- repeated-year header line
 *   DAY MONTH YEAR        <- column-header line
 *   <value line 1>         (1-3 numbers: label 1's Day[/Month/Year])
 *   <value line 2>
 *   ...
 * `label[i]` and `value-line[i]` correspond by position — see
 * shared/block-parser.ts for the general parser this and every other
 * adapter in this phase is built on.
 *
 * Every extracted value still lands as `needs_review`, never `verified`
 * (Constitution "Never Hide Uncertainty") — this rewrite is a real-layout
 * fix, not a claim of higher trust.
 */

interface CanonicalField {
  metricKey: string;
  labelEn: string;
  /** Exact label text as it appears in the real document (case-insensitive match) — NOT a substring/fuzzy pattern, since e.g. "ADR" and "ADR minus Comp" are separate, adjacent labels that must not collide. */
  sourceLabel: string;
  /** Which value in the Day/Month/Year (or Day-only) triple to use — this system's HotelMetric model is per-day, so the Day column (index 0) is the canonical value for every field; Month/Year columns are real evidence (kept in sourceSnippet) but not written as separate metrics in this pass. */
  valueIndex: number;
  plausibleRange?: [number, number];
}

// Mapped against the real sample's exact label text (both pages) — two
// corrections from the pre-rewrite guessed mapping, found only by having
// real data: `rooms_available` maps to "Total Rooms in Hotel" (44), not
// Opera's own "Available Rooms" field (4, which is *remaining unsold*
// capacity, not total inventory) — confirmed by cross-checking
// 40/44 = 90.9% against the report's own printed "% Rooms Occupied" (90.91%).
const CANONICAL_FIELDS: CanonicalField[] = [
  { metricKey: 'occupancy_pct', labelEn: 'Occupancy %', sourceLabel: '% Rooms Occupied', valueIndex: 0, plausibleRange: [0, 100] },
  { metricKey: 'rooms_available', labelEn: 'Rooms Available', sourceLabel: 'Total Rooms in Hotel', valueIndex: 0 },
  { metricKey: 'rooms_sold', labelEn: 'Rooms Sold', sourceLabel: 'Rooms Occupied', valueIndex: 0 },
  { metricKey: 'out_of_order_rooms', labelEn: 'Out of Order Rooms', sourceLabel: 'Out of Order Rooms', valueIndex: 0 },
  { metricKey: 'out_of_inventory_rooms', labelEn: 'Out of Inventory Rooms', sourceLabel: 'Out of Service Rooms', valueIndex: 0 },
  { metricKey: 'arrivals', labelEn: 'Arrivals', sourceLabel: 'Arrival Rooms', valueIndex: 0 },
  { metricKey: 'departures', labelEn: 'Departures', sourceLabel: 'Departure Rooms', valueIndex: 0 },
  { metricKey: 'no_shows', labelEn: 'No-Shows', sourceLabel: 'No Show Rooms', valueIndex: 0 },
  { metricKey: 'cancellations', labelEn: 'Cancellations', sourceLabel: 'Cancelled Reservations for Today', valueIndex: 0 },
  { metricKey: 'room_revenue', labelEn: 'Room Revenue', sourceLabel: 'Room Revenue', valueIndex: 0 },
  { metricKey: 'total_revenue', labelEn: 'Total Revenue', sourceLabel: 'Total Revenue', valueIndex: 0 },
  { metricKey: 'adr', labelEn: 'ADR', sourceLabel: 'ADR', valueIndex: 0 },
  { metricKey: 'complimentary_rooms', labelEn: 'Complimentary Rooms', sourceLabel: 'Complimentary Rooms', valueIndex: 0 },
  { metricKey: 'house_use_rooms', labelEn: 'House Use Rooms', sourceLabel: 'House Use Rooms', valueIndex: 0 },
  { metricKey: 'adults', labelEn: 'Adults', sourceLabel: 'In-House Adults', valueIndex: 0 },
  { metricKey: 'children', labelEn: 'Children', sourceLabel: 'In-House Children', valueIndex: 0 },
  { metricKey: 'total_guests', labelEn: 'Total Guests', sourceLabel: 'Total In-House Persons', valueIndex: 0 },
  // Not present in Manager Flash at all — confirmed absent from the real
  // sample, not guessed. `revpar` is computed downstream from room_revenue
  // + rooms_sold/available (metrics/commands.ts) once those are present, so
  // it doesn't need direct extraction. `stayovers`/`open_balance`/`cash`/
  // `card`/`city_ledger` come from other report types (Open Balance,
  // future channel/payment breakdowns) — honestly `missing` here, not
  // silently substituted with 0 or a guess.
  { metricKey: 'revpar', labelEn: 'RevPAR', sourceLabel: '__not_in_manager_flash__', valueIndex: 0 },
  { metricKey: 'stayovers', labelEn: 'Stayovers', sourceLabel: '__not_in_manager_flash__', valueIndex: 0 },
  { metricKey: 'open_balance', labelEn: 'Open Balance', sourceLabel: '__not_in_manager_flash__', valueIndex: 0 },
  { metricKey: 'cash', labelEn: 'Cash', sourceLabel: '__not_in_manager_flash__', valueIndex: 0 },
  { metricKey: 'card', labelEn: 'Card', sourceLabel: '__not_in_manager_flash__', valueIndex: 0 },
  { metricKey: 'city_ledger', labelEn: 'City Ledger', sourceLabel: '__not_in_manager_flash__', valueIndex: 0 },
];

const TITLE_MARKERS = /manager'?s?\s*-?\s*flash/i;

function isColumnHeaderLine(line: string): boolean {
  if (/^\d{4}(\s+\d{4})*$/.test(line)) return true;
  const words = line.split(/\s+/);
  return words.length > 0 && words.every((w) => /^(DAY|MONTH|YEAR|MTD|YTD|WTD)$/i.test(w));
}

/** Parses every label/value block on every page, returns a case-insensitive lookup keyed by exact label text. */
function parseAllBlocks(pages: PdfPage[]): Map<string, { entry: ZippedValue; page: number }> {
  const byLabel = new Map<string, { entry: ZippedValue; page: number }>();
  for (const page of pages) {
    const lines = splitLines(page.text);
    const block = splitLabelValueBlock(lines, isColumnHeaderLine);
    if (!block) continue;
    for (const entry of zipLabelsToValues(block)) {
      byLabel.set(entry.label.toLowerCase(), { entry, page: page.num });
    }
  }
  return byLabel;
}

export const managerFlashAdapter: ExtractionAdapter = {
  reportType: 'MANAGER_FLASH',

  detect(fullText) {
    if (TITLE_MARKERS.test(fullText)) return 0.9;
    return 0;
  },

  extract(fullText, pages): RawExtractionResult {
    const byLabel = parseAllBlocks(pages);

    const fields: ExtractedField[] = CANONICAL_FIELDS.map((spec) => {
      const found = byLabel.get(spec.sourceLabel.toLowerCase());
      if (!found || found.entry.values[spec.valueIndex] === undefined) {
        return buildMissingField(spec.metricKey, spec.labelEn);
      }
      const value = found.entry.values[spec.valueIndex]!;
      return buildMatchedField({
        metricKey: spec.metricKey,
        labelEn: spec.labelEn,
        sourceLabel: found.entry.label,
        rawText: found.entry.rawLine,
        value,
        sourcePage: found.page,
        sourceSnippet: `${found.entry.label}: ${found.entry.rawLine}`,
        plausibleRange: spec.plausibleRange,
      });
    });

    // BUG FOUND DURING EDI PHASE 2.5 REAL-SAMPLE VERIFICATION: the naive
    // "first date-shaped substring anywhere in the text" match picks up the
    // report's print/run timestamp (always the very first line on the page,
    // e.g. "22/07/26" printed the morning after close), not the actual
    // business date the report covers (e.g. "Filter Calendar/Month to Date
    // 21/07/26" — one day earlier, since a flash report is normally run the
    // next morning for the prior day's close). Every other adapter in this
    // phase anchors to a labeled filter-criteria date for exactly this
    // reason; this one didn't, and real data caught it. Anchored to the
    // "to Date" filter-criteria label instead of the bare first date.
    const dateMatch = fullText.match(/to\s+Date\s+(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i);
    const detectedReportDate = dateMatch?.[1] ? parseLooseDate(dateMatch[1]) : null;

    const typeConfidence = TITLE_MARKERS.test(fullText) ? 0.9 : 0;

    const parserWarnings: string[] = [];
    if (!TITLE_MARKERS.test(fullText)) {
      parserWarnings.push('Report title marker "Manager - flash" not found — type match confidence is 0.');
    }
    if (!dateMatch) {
      parserWarnings.push('No date pattern found in report text — report date must be entered manually.');
    }
    if (byLabel.size === 0) {
      parserWarnings.push('No label/value block detected on any page — this report may not match the expected Manager Flash layout.');
    }
    const missingCanonical = CANONICAL_FIELDS.filter((s) => s.sourceLabel !== '__not_in_manager_flash__' && !byLabel.has(s.sourceLabel.toLowerCase()));
    if (missingCanonical.length > 0) {
      parserWarnings.push(`${missingCanonical.length} expected field(s) not found in this report: ${missingCanonical.map((s) => s.labelEn).join(', ')}.`);
    }

    return { fields, detectedReportDate, typeConfidence, parserWarnings };
  },
};
