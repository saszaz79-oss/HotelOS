import type { ExtractedField, ExtractionAdapter, PdfPage, RawExtractionResult } from '../types';
import { splitLines } from './shared/block-parser';
import { buildMatchedField, buildMissingField } from './shared/field-builder';

/**
 * Day/MTD/YTD Statistics adapter (EDI Phase 2.5) — built and verified
 * against a real sample (`stat_dmy_seg` internal report name).
 *
 * HONESTY NOTE (Constitution "Never Hide Uncertainty" — this is the
 * report where that principle actually changed what got built): unlike
 * Manager Flash / Reservation Statistics / History & Forecast, this
 * report's raw PDF-text extraction order is genuinely scrambled relative
 * to its visual table (market-group labels, column headers, and numbers
 * interleave in an order that does not reliably reconstruct the Grand
 * Total row for two of its five metrics — Room Revenue and %Occupancy —
 * no matter how the surrounding text is searched). Rather than force a
 * positional guess for those two and risk a confidently-wrong number,
 * this adapter extracts ONLY the three metrics it found a real,
 * consistently-anchored 9-number line for (Rooms, ADR, Guest count across
 * Day/MTD/YTD, appearing directly after this report's title text) and
 * leaves Room Revenue / Occupancy% for this specific report type
 * `missing`. The DAY and MONTH columns of even those three duplicate
 * Manager Flash / Reservation Statistics (kept only as cross-report
 * evidence, not written to HotelMetric under those reports' own keys);
 * only the YEAR column is genuinely new information, stored under `ytd_*`
 * keys.
 */

const TITLE_MARKERS = /day\s*\/\s*mtd\s*\/\s*ytd\s+statistics|day.{0,3}mtd.{0,3}ytd\s+statistics/i;
const CONFIDENCE = 0.5; // see module doc — a genuinely more ambiguous layout than the block-parser adapters.

// The anchor line's 9 tokens, in the real sample's order:
// [dayRooms, dayADR, dayGuests, monthRooms, monthADR, monthGuests, yearRooms, yearADR, yearGuests]
const ANCHOR_COLUMNS = {
  yearRooms: 6,
  yearAdr: 7,
  yearGuests: 8,
} as const;

export const dayMtdYtdStatisticsAdapter: ExtractionAdapter = {
  reportType: 'DAY_MTD_YTD_STATISTICS',

  detect(fullText: string): number {
    return TITLE_MARKERS.test(fullText) ? 0.85 : 0;
  },

  extract(fullText: string, pages: PdfPage[]): RawExtractionResult {
    const parserWarnings: string[] = [
      'Only Rooms, ADR, and Guest Count could be reliably located for this report (a fixed 9-number line following the report title) — Room Revenue and Occupancy % are not extracted for this report type because this document\'s raw text order does not reconstruct them reliably. Extracted values are honestly lower-confidence than other adapters given the layout ambiguity.',
    ];

    let anchorRow: { values: number[]; rawLine: string; page: number } | null = null;

    for (const page of pages) {
      const lines = splitLines(page.text);
      const titleIdx = lines.findIndex((l) => TITLE_MARKERS.test(l));
      if (titleIdx === -1) continue;
      // The anchor is the first 9-number line at or after the title line.
      for (let i = titleIdx; i < lines.length; i++) {
        const tokens = lines[i]!.split(/\s+/).filter((t) => /^-?[\d,]+(?:\.\d+)?%?$/.test(t));
        if (tokens.length === 9) {
          anchorRow = { values: tokens.map((t) => Number(t.replace(/,/g, ''))), rawLine: lines[i]!, page: page.num };
          break;
        }
      }
      if (anchorRow) break;
    }

    const fields: ExtractedField[] = [];
    const specs: { metricKey: string; labelEn: string; col: number }[] = [
      { metricKey: 'ytd_rooms_sold', labelEn: 'Year-to-Date Rooms Sold', col: ANCHOR_COLUMNS.yearRooms },
      { metricKey: 'ytd_adr', labelEn: 'Year-to-Date ADR', col: ANCHOR_COLUMNS.yearAdr },
      { metricKey: 'ytd_total_guests', labelEn: 'Year-to-Date Total Guests', col: ANCHOR_COLUMNS.yearGuests },
    ];

    if (!anchorRow) {
      parserWarnings.push('Could not locate the expected 9-number Day/Month/Year summary line — no fields extracted for this report.');
      for (const spec of specs) fields.push(buildMissingField(spec.metricKey, spec.labelEn));
    } else {
      for (const spec of specs) {
        const value = anchorRow.values[spec.col];
        if (value === undefined) {
          fields.push(buildMissingField(spec.metricKey, spec.labelEn));
          continue;
        }
        const field = buildMatchedField({
          metricKey: spec.metricKey,
          labelEn: spec.labelEn,
          sourceLabel: 'Grand Total (Year column)',
          rawText: anchorRow.rawLine,
          value,
          sourcePage: anchorRow.page,
          sourceSnippet: `Day/Month/Year summary line: ${anchorRow.rawLine}`,
        });
        field.confidence = Math.min(field.confidence, CONFIDENCE);
        fields.push(field);
      }
    }

    const dateMatch = fullText.match(/For\s+Date\s+(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i);
    const detectedReportDate = null; // no unambiguous single-date field found to auto-fill — see manager-flash.ts's date-parsing discipline; the "For Date" filter is captured as evidence in a warning instead of guessed into a Date.
    if (dateMatch) {
      parserWarnings.push(`Report filtered "For Date ${dateMatch[1]}" — confirm this matches the intended business date before finalizing.`);
    } else {
      parserWarnings.push('No "For Date" filter line found — report date must be entered manually.');
    }

    return {
      fields,
      detectedReportDate,
      typeConfidence: TITLE_MARKERS.test(fullText) ? 0.85 : 0,
      parserWarnings,
    };
  },
};
