import type { ExtractionAdapter } from '../types';
import { managerFlashAdapter } from './manager-flash';
import { genericFallbackAdapter } from './generic-fallback';
import { reservationStatisticsAdapter } from './reservation-statistics';
import { historyForecastAdapter } from './history-forecast';
import { dayMtdYtdStatisticsAdapter } from './day-mtd-ytd-statistics';

/**
 * v0.1 scope (Roadmap M3, DECISIONS.md D22): only Manager Flash has a
 * field-level extraction adapter. Reservation Statistics, History &
 * Forecast, and Day MTD YTD Statistics (EDI Phase 1 — the Analysis
 * Session's other 3 required report slots) only get type-detection-only
 * adapters (title-marker match, zero structured fields) so
 * `ReportDocument.reportType` records the correct type instead of falling
 * through to `GENERIC` — the UI distinguishes "uploaded, type recognized"
 * from "structurally validated" using this. Open Balance / Reservation
 * Statistics 1 still fall through to the generic fallback entirely.
 */
const ADAPTERS: ExtractionAdapter[] = [
  managerFlashAdapter,
  reservationStatisticsAdapter,
  historyForecastAdapter,
  dayMtdYtdStatisticsAdapter,
];

export function selectAdapter(text: string): ExtractionAdapter {
  let best = genericFallbackAdapter;
  let bestScore = genericFallbackAdapter.detect(text);

  for (const adapter of ADAPTERS) {
    const score = adapter.detect(text);
    if (score > bestScore) {
      best = adapter;
      bestScore = score;
    }
  }

  return best;
}

export { managerFlashAdapter, genericFallbackAdapter, reservationStatisticsAdapter, historyForecastAdapter, dayMtdYtdStatisticsAdapter };
