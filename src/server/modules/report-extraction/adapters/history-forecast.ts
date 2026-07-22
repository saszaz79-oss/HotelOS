import type { ExtractedField, ExtractionAdapter, PdfPage, RawExtractionResult } from '../types';
import { splitLines } from './shared/block-parser';
import { buildMatchedField, buildMissingField } from './shared/field-builder';

/**
 * History & Forecast (Business Block) adapter (EDI Phase 2.5) — built and
 * verified against a real sample (`history_forecast_blk` internal report
 * name). This report's real layout is genuinely harder than Manager
 * Flash/Reservation Statistics: it's column-major (every date first, then
 * every date's "Total Occ Rms" value, then every date's "Arr Rms" value,
 * etc. — not the label-block/value-block pattern the other adapters use),
 * with per-date rows, a "Blocks" sub-section, two "Subtotal" rows, and one
 * final "Total" row across the whole queried date range.
 *
 * Given that structural complexity, this version deliberately extracts
 * ONLY the final aggregate "Total" row — anchored on the real, observed
 * trailing label sequence ("Subtotal" / "Subtotal" / "Total") that follows
 * it — rather than attempting the full day-by-day pickup/pace breakdown.
 * Confidence is set lower than the other adapters (see CONFIDENCE below)
 * specifically because this is a positional heuristic on a genuinely more
 * ambiguous layout, not a clean anchored block match — that honesty is the
 * point, not a limitation to hide. Day-by-day pickup extraction is a
 * documented future enhancement (see docs/REPORT_ADAPTERS.md), not
 * silently missing.
 *
 * This report is genuinely NEW information Manager Flash never provides:
 * a forward-looking occupancy/revenue window (the queried date range, here
 * a rolling ~30 days ahead) — mapped to `forecast_*` metric keys, never
 * the same keys as a single day's actuals.
 */

const TITLE_MARKERS = /history\s+(and|&)\s+forecast/i;
const CONFIDENCE = 0.5; // lower than the block-parser adapters — see module doc.

// The Total row's columns, in the real sample's order (verified):
// TotalOccRms, ArrRms, IndDeductRms, IndDeductRev, IndNonDRms, IndNonDRev,
// BlkDeductRms, BlkDeductRev, BlkNonDRms, BlkNonDRev, Occ%, TotalHotelRev, AvgRate
const COLUMNS = {
  totalOccRooms: 0,
  occupancyPct: 10,
  totalRoomRevenue: 11,
  averageRate: 12,
} as const;

export const historyForecastAdapter: ExtractionAdapter = {
  reportType: 'HISTORY_FORECAST',

  detect(fullText: string): number {
    return TITLE_MARKERS.test(fullText) ? 0.85 : 0;
  },

  extract(fullText: string, pages: PdfPage[]): RawExtractionResult {
    const parserWarnings: string[] = [
      'This adapter extracts only the report-wide Total row (day-by-day pickup/pace breakdown is not yet extracted). Confidence is intentionally lower than other adapters given this report\'s more complex layout — verify against the source PDF before relying on these figures.',
    ];

    let totalRow: { values: number[]; rawLine: string; page: number } | null = null;

    for (const page of pages) {
      const lines = splitLines(page.text);
      // Anchor: the numeric line immediately preceding a "Subtotal"/
      // "Subtotal"/"Total" label sequence (verified against the real
      // sample) is the report-wide Total row.
      for (let i = 0; i < lines.length - 2; i++) {
        if (lines[i]!.toLowerCase() === 'subtotal' && lines[i + 1]!.toLowerCase() === 'subtotal' && lines[i + 2]!.toLowerCase() === 'total') {
          const candidate = lines[i - 1];
          if (candidate && /^[\d.,%\s]+$/.test(candidate)) {
            const tokens = candidate.split(/\s+/).filter((t) => /^-?[\d,]+(?:\.\d+)?%?$/.test(t));
            totalRow = { values: tokens.map((t) => Number(t.replace(/,/g, '').replace(/%$/, ''))), rawLine: candidate, page: page.num };
          }
          break;
        }
      }
      if (totalRow) break;
    }

    const fields: ExtractedField[] = [];
    const specs: { metricKey: string; labelEn: string; col: number; plausibleRange?: [number, number] }[] = [
      { metricKey: 'forecast_rooms_occupied', labelEn: 'Forecast Rooms Occupied (period total)', col: COLUMNS.totalOccRooms },
      { metricKey: 'forecast_occupancy_pct', labelEn: 'Forecast Occupancy %', col: COLUMNS.occupancyPct, plausibleRange: [0, 100] },
      { metricKey: 'forecast_room_revenue', labelEn: 'Forecast Room Revenue (period total)', col: COLUMNS.totalRoomRevenue },
      { metricKey: 'forecast_adr', labelEn: 'Forecast Average Rate', col: COLUMNS.averageRate },
    ];

    if (!totalRow) {
      parserWarnings.push('No report-wide "Total" row found (expected after two "Subtotal" lines) — this report may not match the expected History & Forecast layout, or has no block reservations.');
      for (const spec of specs) fields.push(buildMissingField(spec.metricKey, spec.labelEn));
    } else {
      for (const spec of specs) {
        const value = totalRow.values[spec.col];
        if (value === undefined) {
          fields.push(buildMissingField(spec.metricKey, spec.labelEn));
          continue;
        }
        const field = buildMatchedField({
          metricKey: spec.metricKey,
          labelEn: spec.labelEn,
          sourceLabel: 'Total',
          rawText: totalRow.rawLine,
          value,
          sourcePage: totalRow.page,
          sourceSnippet: `Total row: ${totalRow.rawLine}`,
          plausibleRange: spec.plausibleRange,
        });
        field.confidence = Math.min(field.confidence, CONFIDENCE);
        fields.push(field);
      }
    }

    const fromMatch = fullText.match(/From\s+Date\s+(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i);
    const toMatch = fullText.match(/To\s+Date\s+(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i);
    if (fromMatch && toMatch) {
      parserWarnings.push(`Forecast figures cover the queried date range (${fromMatch[1]} to ${toMatch[1]}), not a single business date — treat as a period aggregate.`);
    }
    const detectedReportDate = null; // this report's "date" is a range, not a single business date — never guess one.

    return {
      fields,
      detectedReportDate,
      typeConfidence: TITLE_MARKERS.test(fullText) ? 0.85 : 0,
      parserWarnings,
    };
  },
};
