import type { ExtractedField, ExtractionAdapter, PdfPage, RawExtractionResult } from '../types';
import { splitLines, splitLabelValueBlock, zipLabelsToValues } from './shared/block-parser';
import { buildMatchedField, buildMissingField } from './shared/field-builder';

/**
 * Reservation Statistics adapter (EDI Phase 2.5) — built and verified
 * against a real sample (`res_statistics2` internal report name). Real
 * layout: one label line per market-segment row (e.g. "BAR", "BOK",
 * "Grand Total"), then a single column-header line ("No. of Rooms  Room
 * Revenue  F&B Revenue  Misc Revenue  ADR  % Occ.  No. of Guest  % Multi
 * Occ.  Single Occ.  Multi Occ."), then one value-line per segment with
 * all 10 numbers. Same label[i]/value-line[i] positional pairing as
 * Manager Flash — see shared/block-parser.ts.
 *
 * This report covers the calendar month to date, not a single business
 * date (confirmed: its Grand Total exactly matches Manager Flash's own
 * MONTH column for the same date in the sample used to build this) — so
 * its Grand Total row is extracted into `mtd_*` metric keys, deliberately
 * NOT the same keys Manager Flash's Day column populates. Writing a
 * month-to-date figure into the same key as a single day's actual would
 * silently corrupt whichever value wrote second.
 *
 * Per-market-segment rows (BAR/BOK/COR/...) are real evidence in this
 * report but are NOT extracted into HotelMetric in this pass — there is no
 * existing storage shape for per-segment dimensional data (would need
 * either per-segment metric keys or a JSON column, neither of which exists
 * yet). Documented here as a known, honest gap, not silently dropped.
 */

const HEADER_MARKER = /No\.\s*of\s*Rooms\s+Room\s+Revenue/i;

function isHeaderLine(line: string): boolean {
  return HEADER_MARKER.test(line);
}

// Substring match, not a full-line anchor — PDF text extraction sometimes
// merges a footer timestamp onto the same line as the title depending on
// page positioning. Excludes "Reservation Statistics 1" (a different,
// distinct report/ReportType) via the negative lookahead.
const TITLE_MARKERS = /reservation\s+statistics(?!\s*\d)/i;

// Column order in the real sample's header line, 0-indexed.
const COLUMNS = {
  roomsSold: 0,
  roomRevenue: 1,
  adr: 4,
  occupancyPct: 5,
  totalGuests: 6,
} as const;

export const reservationStatisticsAdapter: ExtractionAdapter = {
  reportType: 'RESERVATION_STATISTICS',

  detect(fullText: string): number {
    return TITLE_MARKERS.test(fullText) ? 0.9 : 0;
  },

  extract(fullText: string, pages: PdfPage[]): RawExtractionResult {
    const parserWarnings: string[] = [];
    let grandTotalRow: { values: number[]; rawLine: string; page: number } | null = null;

    for (const page of pages) {
      const lines = splitLines(page.text);
      const block = splitLabelValueBlock(lines, isHeaderLine);
      if (!block) continue;
      const zipped = zipLabelsToValues(block);
      const grandTotal = zipped.find((z) => z.label.toLowerCase() === 'grand total');
      if (grandTotal) {
        grandTotalRow = { values: grandTotal.values, rawLine: grandTotal.rawLine, page: page.num };
        break;
      }
    }

    const fields: ExtractedField[] = [];
    const specs: { metricKey: string; labelEn: string; col: number; plausibleRange?: [number, number] }[] = [
      { metricKey: 'mtd_rooms_sold', labelEn: 'Month-to-Date Rooms Sold', col: COLUMNS.roomsSold },
      { metricKey: 'mtd_room_revenue', labelEn: 'Month-to-Date Room Revenue', col: COLUMNS.roomRevenue },
      { metricKey: 'mtd_adr', labelEn: 'Month-to-Date ADR', col: COLUMNS.adr },
      { metricKey: 'mtd_occupancy_pct', labelEn: 'Month-to-Date Occupancy %', col: COLUMNS.occupancyPct, plausibleRange: [0, 100] },
      { metricKey: 'mtd_total_guests', labelEn: 'Month-to-Date Total Guests', col: COLUMNS.totalGuests },
    ];

    if (!grandTotalRow) {
      parserWarnings.push('No "Grand Total" row found under the expected column-header line — this report may not match the expected Reservation Statistics layout.');
      for (const spec of specs) fields.push(buildMissingField(spec.metricKey, spec.labelEn));
    } else {
      for (const spec of specs) {
        const value = grandTotalRow.values[spec.col];
        if (value === undefined) {
          fields.push(buildMissingField(spec.metricKey, spec.labelEn));
          continue;
        }
        fields.push(
          buildMatchedField({
            metricKey: spec.metricKey,
            labelEn: spec.labelEn,
            sourceLabel: 'Grand Total',
            rawText: grandTotalRow.rawLine,
            value,
            sourcePage: grandTotalRow.page,
            sourceSnippet: `Grand Total: ${grandTotalRow.rawLine}`,
            plausibleRange: spec.plausibleRange,
          })
        );
      }
      parserWarnings.push('Per-market-segment breakdown (BAR/BOK/COR/etc.) was detected but is not yet extracted into stored metrics — only the Grand Total row is captured in this version.');
    }

    // "Calendar/Month 2026, 07" — unambiguous (explicit year + month
    // labels, no day/month-order guessing needed), unlike the loose
    // DD/MM-or-MM/DD dates other adapters have to disambiguate.
    const dateMatch = fullText.match(/Calendar\/Month\s+(\d{4}),\s*(\d{1,2})/i);
    const detectedReportDate = dateMatch
      ? new Date(Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, 1))
      : null;
    if (!detectedReportDate) {
      parserWarnings.push('No "Calendar/Month" filter line found — report period must be entered manually.');
    }

    return {
      fields,
      detectedReportDate,
      typeConfidence: TITLE_MARKERS.test(fullText) ? 0.9 : 0,
      parserWarnings,
    };
  },
};
